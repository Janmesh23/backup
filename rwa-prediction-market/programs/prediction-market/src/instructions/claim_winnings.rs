use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use crate::state::{Market, Position};
use crate::events::PayoutClaimed;
use crate::errors::MarketError;

pub fn handler(ctx: Context<ClaimWinnings>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    // Validation
    require!(market.resolved, MarketError::NotResolved);
    require!(!position.claimed, MarketError::AlreadyClaimed);
    require!(position.side == market.winning_side, MarketError::NotWinner);

    // Payout calculation (Pro-rata share of total pool)
    // winning_pool = yes_pool if YES won, else no_pool
    let winning_pool = if market.winning_side == 1 {
        market.yes_pool
    } else {
        market.no_pool
    };

    // payout = (position.amount * total_pool) / winning_pool
    let total_pool = market.total_pool();
    require!(winning_pool > 0, MarketError::Overflow);
    let payout = (position.amount as u128)
        .checked_mul(total_pool as u128)
        .ok_or(MarketError::Overflow)?
        .checked_div(winning_pool as u128)
        .ok_or(MarketError::Overflow)? as u64;

    // 1. Transfer payout from market escrow
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
        to: ctx.accounts.claimant_token_account.to_account_info(),
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
    transfer_checked(cpi_ctx, payout, ctx.accounts.collateral_mint.decimals)?;

    // 2. Mark position as claimed
    position.claimed = true;

    emit!(PayoutClaimed {
        market: market.key(),
        claimant: ctx.accounts.owner.key(),
        amount: payout,
        side: position.side,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    #[account(
        mut,
        seeds = [b"market", market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        has_one = market,
        has_one = owner @ MarketError::NotWinner,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        token::mint = collateral_mint,
        token::authority = owner,
        token::token_program = token_program,
    )]
    pub claimant_token_account: InterfaceAccount<'info, TokenAccount>,

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
