use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface},
};
use crate::state::Market;

pub fn handler(ctx: Context<Faucet>, amount: u64) -> Result<()> {
    // Mint tokens to the requester using creator as authority
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.requester_token_account.to_account_info(),
        authority: ctx.accounts.creator.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    mint_to(cpi_ctx, amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub requester: Signer<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [b"market", creator.key().as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        has_one = creator,
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = requester,
        associated_token::mint = mint,
        associated_token::authority = requester,
        associated_token::token_program = token_program,
    )]
    pub requester_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
