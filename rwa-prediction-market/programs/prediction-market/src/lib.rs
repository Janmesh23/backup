pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("BVSgTqXMeAnTJiUcAB6SG5CXAsthxxVxm14ygVa9knGe");

#[program]
pub mod prediction_market {
    use super::*;

    pub fn mint_rwa(ctx: Context<MintRwa>, args: MintRwaArgs) -> Result<()> {
        instructions::mint_rwa::handler(ctx, args)
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_id: u64,
        title: String,
        pyth_feed: Pubkey,
        strike_price: i64,
        strike_expo: i32,
        collateral_mint: Pubkey,
        expiry: i64,
        is_private: bool,
        room_fee_lamports: u64,
    ) -> Result<()> {
        instructions::create_market::handler(
            ctx,
            market_id,
            title,
            pyth_feed,
            strike_price,
            strike_expo,
            expiry,
            is_private,
            room_fee_lamports,
        )
    }

    pub fn place_bet(ctx: Context<PlaceBet>, side: u8, amount: u64) -> Result<()> {
        instructions::place_bet::handler(ctx, side, amount)
    }

    pub fn cancel_bet(ctx: Context<CancelBet>) -> Result<()> {
        instructions::cancel_bet::handler(ctx)
    }

    pub fn sample_price(ctx: Context<SamplePrice>) -> Result<()> {
        instructions::sample_price::handler(ctx)
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        instructions::resolve_market::handler(ctx)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handler(ctx)
    }

    pub fn buy_room_access(ctx: Context<BuyRoomAccess>) -> Result<()> {
        instructions::buy_room_access::handler(ctx)
    }

    pub fn faucet(ctx: Context<Faucet>, amount: u64) -> Result<()> {
        instructions::faucet::handler(ctx, amount)
    }
}
