use anchor_lang::prelude::*;
use crate::state::Market;
use crate::events::MarketResolved;
use crate::errors::MarketError;

pub fn handler(ctx: Context<ResolveMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;

    // Validation
    require!(!market.resolved, MarketError::AlreadyResolved);
    require!(clock.unix_timestamp > market.expiry, MarketError::MarketNotExpired);
    require!(market.twap_samples > 0, MarketError::NoTwapSamples);

    // Compute TWAP
    require!(market.twap_samples >= 3, MarketError::InsufficientSamples);
    
    let twap_i128 = market.twap_accumulator
        .checked_div(market.twap_samples as i128)
        .ok_or(MarketError::Overflow)?;
    
    // Bounds check to prevent silent truncation
    require!(twap_i128 >= i64::MIN as i128 && twap_i128 <= i64::MAX as i128, MarketError::Overflow);
    let twap = twap_i128 as i64;

    // Compare TWAP against strike (both in same exponent — Pyth raw i64)
    let winning_side = if twap > market.strike_price { 
        1u8 // YES
    } else { 
        2u8 // NO
    };

    market.final_twap = twap;
    market.winning_side = winning_side;
    market.resolved = true;

    emit!(MarketResolved {
        market: market.key(),
        winning_side,
        final_twap: twap,
        total_pool: market.total_pool(),
        yes_pool: market.yes_pool,
        no_pool: market.no_pool,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>, // Permissionless

    #[account(
        mut,
        seeds = [b"market", market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,

    pub system_program: Program<'info, System>,
}
