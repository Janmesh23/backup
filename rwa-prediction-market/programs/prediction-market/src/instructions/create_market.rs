use anchor_lang::prelude::*;
use crate::state::Market;
use crate::events::MarketCreated;
use crate::constants::TWAP_WINDOW_SECONDS;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

pub fn handler(
    ctx: Context<CreateMarket>,
    market_id: u64,
    title: String,
    pyth_feed: Pubkey,
    strike_price: i64,
    strike_expo: i32,
    expiry: i64,
    is_private: bool,
    room_fee_lamports: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let clock = Clock::get()?;

    // Validation
    require!(title.len() <= 100, crate::errors::MarketError::MarketIdentifierTooLong); 
    // Reduced to 10 seconds for easier local testing
    require!(expiry > clock.unix_timestamp + 10, crate::errors::MarketError::ExpiryTooSoon);
    require!(strike_price > 0, crate::errors::MarketError::InvalidPrice);

    market.creator = ctx.accounts.creator.key();
    market.market_id = market_id;
    market.pyth_feed = pyth_feed;
    market.strike_price = strike_price;
    market.strike_expo = strike_expo;
    market.collateral_mint = ctx.accounts.collateral_mint.key();
    market.created_at = clock.unix_timestamp;
    market.expiry = expiry;
    market.is_private = is_private;
    market.room_fee_lamports = room_fee_lamports;
    market.title = title.clone();
    market.bump = ctx.bumps.market;
    
    // TWAP config
    market.twap_window_start = expiry - TWAP_WINDOW_SECONDS;
    market.winning_side = 0;
    market.resolved = false;

    emit!(MarketCreated {
        market: market.key(),
        creator: market.creator,
        title,
        pyth_feed,
        strike_price,
        strike_expo,
        collateral_mint: ctx.accounts.collateral_mint.key(),
        expiry,
        is_private,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    #[account(
        init,
        payer = creator,
        seeds = [b"market", creator.key().as_ref(), &market_id.to_le_bytes()],
        bump,
        space = Market::LEN
    )]
    pub market: Box<Account<'info, Market>>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = collateral_mint,
        associated_token::authority = market,
        associated_token::token_program = token_program,
    )]
    pub market_escrow: InterfaceAccount<'info, TokenAccount>,
}
