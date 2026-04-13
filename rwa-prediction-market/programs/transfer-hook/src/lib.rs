use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use spl_tlv_account_resolution::state::ExtraAccountMetaList;
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("G6tkJFd5Qkt6Nw2c7GgABdVSN71KjiajpkDMtviCn2d6");

const PREDICTION_MARKET_PROGRAM_ID: Pubkey = pubkey!("9t99QGY5dSmQv9RcomjrCHBmvfYhgwdrWjVspb1QmBT7");

#[program]
pub mod transfer_hook {
    use super::*;

    /// The standard Anchor instruction for transfer hook logic.
    /// This is where we define the business logic for the hook.
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        let destination = &ctx.accounts.destination_account;

        msg!("--- Transfer Hook Check ---");
        msg!("Destination Account: {}", destination.key());
        msg!("Destination Authority: {}", destination.owner);
        msg!("Internal Target ID: {}", PREDICTION_MARKET_PROGRAM_ID);

        // Explicit check for authority match
        if destination.owner == PREDICTION_MARKET_PROGRAM_ID {
            msg!("MATCH FOUND! Emitting event.");
            emit!(CollateralDeposited {
                mint: ctx.accounts.mint.key(),
                destination: destination.key(),
                amount,
            });
        } else {
            msg!("No match. Destination authority is not the prediction market.");
        }

        Ok(())
    }

    /// This instruction initializes the ExtraAccountMetaList PDA.
    /// It must be called for every mint that uses this transfer hook.
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        let account_info = &ctx.accounts.extra_account_meta_list;
        let mut data = account_info.try_borrow_mut_data()?;
        
        // Initialize the header with zero extra accounts
        ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &[])?;
        
        Ok(())
    }

    /// THE FINAL FIX: Raw fallback router.
    /// Anchor's default router doesn't recognize the SPL Transfer Hook discriminator.
    /// By using the raw signature (no Context), we manually catch the SPL interface call.
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)?;
        
        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let mut accounts_iter = accounts;
                let mut bumps = TransferHookBumps::default();
                let mut reallocs = std::collections::BTreeSet::new();

                let mut accounts_struct = TransferHook::try_accounts(
                    program_id,
                    &mut accounts_iter,
                    data,
                    &mut bumps,
                    &mut reallocs,
                )?;

                let ctx = Context::new(program_id, &mut accounts_struct, &[], bumps);
                transfer_hook(ctx, amount)
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(token::mint = mint)]
    pub source_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub destination_account: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: Required by SPL Transfer Hook interface
    pub owner_delegate: UncheckedAccount<'info>,
    /// CHECK: Required by SPL Transfer Hook interface. Derived from [b"extra-account-metas", mint]
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Initialized PDA for the Transfer Hook interface
    #[account(
        init,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump,
        payer = payer,
        space = 8 + 64 // Discriminator + header padding
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct CollateralDeposited {
    pub mint: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}
