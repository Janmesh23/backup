use anchor_lang::prelude::*;
use pyth_sdk_solana::state::{PriceAccount, PriceStatus};
use crate::state::Market;
use crate::events::PriceSampled;
use crate::errors::MarketError;
use crate::constants::MAX_PRICE_AGE_SECONDS;

pub fn handler(ctx: Context<SamplePrice>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;

    // Validation
    require_keys_eq!(
        ctx.accounts.pyth_price.key(),
        market.pyth_feed,
        MarketError::InvalidPythFeed
    );
    require!(!market.resolved, MarketError::AlreadyResolved);
    require!(clock.unix_timestamp >= market.twap_window_start, MarketError::TooEarlyToSample);
    require!(clock.unix_timestamp <= market.expiry, MarketError::MarketExpired);
    require!(clock.slot != market.last_sampled_slot, MarketError::AlreadySampledThisSlot);

    // Pyth validation logic
    let price_account_data = ctx.accounts.pyth_price.try_borrow_data()?;
    let price_account: &PriceAccount = pyth_sdk_solana::state::load_price_account(&price_account_data)
        .map_err(|_| MarketError::PriceStale)?;

    // Status and Age check
    require!(price_account.agg.status == PriceStatus::Trading, MarketError::PriceStale);
    require!(
        price_account.timestamp >= clock.unix_timestamp - MAX_PRICE_AGE_SECONDS as i64,
        MarketError::PriceStale
    );

    // Manual confidence check (conf / price < 0.005)
    let price_val = price_account.agg.price;
    let conf_val = price_account.agg.conf;
    let price_abs = price_val.unsigned_abs();
    
    require!(
        conf_val.checked_mul(1000).ok_or(MarketError::Overflow)?
            < (price_abs as u64).checked_mul(5).ok_or(MarketError::Overflow)?,
        MarketError::PriceUncertain
    );

    // TWAP Update logic using the aggregate price
    market.twap_accumulator = market.twap_accumulator
        .checked_add(price_val as i128)
        .ok_or(MarketError::Overflow)?;
    market.twap_samples = market.twap_samples.checked_add(1).ok_or(MarketError::Overflow)?;
    market.last_sampled_slot = clock.slot;

    emit!(PriceSampled {
        market: market.key(),
        price: price_val,
        slot: clock.slot,
        samples_so_far: market.twap_samples,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SamplePrice<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Validated via load_price_feed_from_account_info in handler
    pub pyth_price: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
