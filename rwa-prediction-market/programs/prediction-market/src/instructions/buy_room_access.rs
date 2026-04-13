use anchor_lang::prelude::*;
use crate::state::{Market, RoomAccess};
use crate::events::RoomAccessGranted;
use crate::errors::MarketError;

pub fn handler(ctx: Context<BuyRoomAccess>) -> Result<()> {
    let market = &ctx.accounts.market;
    let clock = Clock::get()?;

    // 1. Validation
    require!(market.is_private, MarketError::MarketNotPrivate); 
    
    // 2. Transfer fee from buyer to creator (system program transfer)
    let lamports = market.room_fee_lamports;
    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.creator.key(),
            lamports,
        ),
        &[
            ctx.accounts.buyer.to_account_info(),
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // 3. Initialize RoomAccess PDA
    let room_access = &mut ctx.accounts.room_access;
    room_access.market = market.key();
    room_access.user = ctx.accounts.buyer.key();
    room_access.paid_at = clock.unix_timestamp;
    room_access.fee_paid = lamports;
    room_access.bump = ctx.bumps.room_access;

    emit!(RoomAccessGranted {
        market: market.key(),
        user: ctx.accounts.buyer.key(),
        fee_paid: lamports,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct BuyRoomAccess<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Recipient of the room fee
    #[account(mut, address = market.creator)]
    pub creator: AccountInfo<'info>,

    #[account(
        seeds = [b"market", creator.key().as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = buyer,
        seeds = [b"room-access", market.key().as_ref(), buyer.key().as_ref()],
        bump,
        space = RoomAccess::LEN
    )]
    pub room_access: Account<'info, RoomAccess>,

    pub system_program: Program<'info, System>,
}
