use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use crate::state::{Market, Position, RoomAccess};
use crate::events::BetPlaced;
use crate::errors::MarketError;

pub fn handler(ctx: Context<PlaceBet>, side: u8, amount: u64) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let clock = Clock::get()?;

    // Validation
    require!(amount > 0, MarketError::ZeroAmount);
    require!(side == 1 || side == 2, MarketError::InvalidSide);
    require!(!market.resolved, MarketError::AlreadyResolved);
    require!(clock.unix_timestamp < market.expiry, MarketError::MarketExpired);

    // Private market access check
    if market.is_private {
        let room_access = ctx.accounts.room_access.as_ref().ok_or(MarketError::RoomAccessRequired)?;
        require!(room_access.market == market.key(), MarketError::RoomAccessRequired);
        require!(room_access.user == ctx.accounts.bettor.key(), MarketError::RoomAccessRequired);
    }

    // 1. Transfer collateral to escrow
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.bettor_token_account.to_account_info(),
        mint: ctx.accounts.collateral_mint.to_account_info(),
        to: ctx.accounts.market_escrow.to_account_info(),
        authority: ctx.accounts.bettor.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    transfer_checked(cpi_ctx, amount, ctx.accounts.collateral_mint.decimals)?;

    // 2. Update position
    if position.amount == 0 {
        position.owner = ctx.accounts.bettor.key();
        position.market = market.key();
        position.side = side;
        position.created_at = clock.unix_timestamp;
        position.bump = ctx.bumps.position;
    } else {
        // Ensure user isn't changing sides in the same position account
        require!(position.side == side, MarketError::InvalidSide);
    }
    
    position.amount = position.amount.checked_add(amount).ok_or(MarketError::Overflow)?;

    // 3. Update market pools
    if side == 1 {
        market.yes_pool = market.yes_pool.checked_add(amount).ok_or(MarketError::Overflow)?;
    } else {
        market.no_pool = market.no_pool.checked_add(amount).ok_or(MarketError::Overflow)?;
    }

    emit!(BetPlaced {
        market: market.key(),
        bettor: ctx.accounts.bettor.key(),
        side,
        amount,
        yes_pool: market.yes_pool,
        no_pool: market.no_pool,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Box<Account<'info, Market>>,

    #[account(
        init_if_needed,
        payer = bettor,
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref()],
        bump,
        space = Position::LEN
    )]
    pub position: Box<Account<'info, Position>>,

    #[account(
        mut,
        token::mint = collateral_mint,
        token::authority = bettor,
    )]
    pub bettor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = market,
    )]
    pub market_escrow: InterfaceAccount<'info, TokenAccount>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,

    /// Optional: Only required if market.is_private is true
    pub room_access: Option<Account<'info, RoomAccess>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
