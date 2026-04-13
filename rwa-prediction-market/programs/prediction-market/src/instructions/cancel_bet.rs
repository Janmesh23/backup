use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use crate::state::{Market, Position};
use crate::events::BetCancelled;
use crate::errors::MarketError;

pub fn handler(ctx: Context<CancelBet>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let clock = Clock::get()?;

    // Validation
    require!(!market.resolved, MarketError::AlreadyResolved);
    require!(clock.unix_timestamp < market.twap_window_start, MarketError::TooEarlyToSample); // Cannot cancel once sampling window starts
    require!(clock.unix_timestamp < market.expiry, MarketError::MarketExpired);
    require!(position.amount > 0, MarketError::ZeroAmount);
    require!(!position.claimed, MarketError::AlreadyClaimed);

    let amount = position.amount;

    // 1. Transfer collateral back to bettor
    let seeds = &[
        b"market",
        market.creator.as_ref(),
        &market.market_id.to_le_bytes(),
        &[market.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.market_escrow.to_account_info(),
        mint: ctx.accounts.collateral_mint.to_account_info(),
        to: ctx.accounts.bettor_token_account.to_account_info(),
        authority: market.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer,
    ).with_remaining_accounts(vec![
        ctx.accounts.extra_account_meta_list.to_account_info(),
        ctx.accounts.transfer_hook_program.to_account_info(),
    ]);
    transfer_checked(cpi_ctx, amount, ctx.accounts.collateral_mint.decimals)?;

    // 2. Update market pools
    if position.side == 1 {
        market.yes_pool = market.yes_pool.checked_sub(amount).ok_or(MarketError::Overflow)?;
    } else {
        market.no_pool = market.no_pool.checked_sub(amount).ok_or(MarketError::Overflow)?;
    }

    // 3. Close position logic
    position.amount = 0;
    position.claimed = true; // Mark as settled/closed

    emit!(BetCancelled {
        market: market.key(),
        bettor: ctx.accounts.owner.key(),
        amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CancelBet<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    #[account(
        mut,
        seeds = [b"market", market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        has_one = owner @ MarketError::NotWinner,
        has_one = market
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        token::mint = collateral_mint,
        token::authority = owner,
        token::token_program = token_program,
    )]
    pub bettor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = market,
        associated_token::token_program = token_program,
    )]
    pub market_escrow: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Validated via seeds in the transfer hook program
    #[account(
        seeds = [b"extra-account-metas", collateral_mint.key().as_ref()],
        seeds::program = transfer_hook_program.key(),
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// CHECK: Validated via address constraint to the repo's transfer hook program
    #[account(address = pubkey!("G6tkJFd5Qkt6Nw2c7GgABdVSN71KjiajpkDMtviCn2d6"))]
    pub transfer_hook_program: UncheckedAccount<'info>,
}
