use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface},
};
use crate::events::RwaMinted;

pub fn handler(ctx: Context<MintRwa>, args: MintRwaArgs) -> Result<()> {
    // 1. Manually transfer extra rent to cover the dynamic metadata expansion
    let additional_space = 512; // Extra padding for strings and custom fields
    let rent = Rent::get()?;
    let lamports_required = rent.minimum_balance(additional_space);
    
    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.creator.key(),
            &ctx.accounts.mint.key(),
            lamports_required,
        ),
        &[
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // 2. Initialize TokenMetadata
    let init_meta_ix = spl_token_metadata_interface::instruction::initialize(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.mint.key(),
        &ctx.accounts.creator.key(),
        &ctx.accounts.mint.key(),
        &ctx.accounts.creator.key(),
        args.name.clone(),
        args.symbol.clone(),
        String::new(), // uri
    );
    
    anchor_lang::solana_program::program::invoke(
        &init_meta_ix,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.creator.to_account_info(),
        ],
    )?;

    // 3. Update rwa_type as a custom field
    let update_field_ix = spl_token_metadata_interface::instruction::update_field(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.mint.key(),
        &ctx.accounts.creator.key(),
        spl_token_metadata_interface::state::Field::Key("rwa_type".to_string()),
        args.rwa_type.clone(),
    );

    anchor_lang::solana_program::program::invoke(
        &update_field_ix,
        &[
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.creator.to_account_info(),
        ],
    )?;

    // 4. Mint initial supply to creator
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.creator_token_account.to_account_info(),
        authority: ctx.accounts.creator.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    mint_to(cpi_ctx, args.initial_supply)?;

    // 5. Initialize Transfer Hook ExtraAccountMetaList
    let (meta_list_pda, _bump) = Pubkey::find_program_address(
        &[b"extra-account-metas", ctx.accounts.mint.key().as_ref()],
        &ctx.accounts.transfer_hook_program.key(),
    );

    // Anchor discriminator for "global:initialize_extra_account_meta_list"
    let mut data = vec![75, 243, 55, 60, 49, 241, 211, 241];
    
    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.transfer_hook_program.key(),
            accounts: vec![
                AccountMeta::new(ctx.accounts.creator.key(), true),
                AccountMeta::new(meta_list_pda, false),
                AccountMeta::new_readonly(ctx.accounts.mint.key(), false),
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
            ],
            data,
        },
        &[
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.extra_account_meta_list.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    emit!(RwaMinted {
        mint: ctx.accounts.mint.key(),
        creator: ctx.accounts.creator.key(),
        name: args.name,
        symbol: args.symbol,
        rwa_type: args.rwa_type,
        supply: args.initial_supply,
    });

    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintRwaArgs {
    pub name: String,
    pub symbol: String,
    pub rwa_type: String,
    pub initial_supply: u64,
    pub decimals: u8,
}

#[derive(Accounts)]
#[instruction(args: MintRwaArgs)]
pub struct MintRwa<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        mint::decimals = args.decimals,
        mint::authority = creator,
        mint::token_program = token_program,
        extensions::metadata_pointer::authority = creator,
        extensions::metadata_pointer::metadata_address = mint.key(),
        extensions::transfer_hook::authority = creator,
        extensions::transfer_hook::program_id = transfer_hook_program.key(),
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = creator,
        associated_token::token_program = token_program,
    )]
    pub creator_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Initialized via CPI to transfer_hook_program in the handler
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        seeds::program = transfer_hook_program.key(),
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// CHECK: Validated via address constraint to the repo's transfer hook program
    #[account(address = pubkey!("G6tkJFd5Qkt6Nw2c7GgABdVSN71KjiajpkDMtviCn2d6"))]
    pub transfer_hook_program: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
