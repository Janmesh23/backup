use anchor_lang::prelude::*;

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub title: String,
    pub pyth_feed: Pubkey,
    pub strike_price: i64,
    pub strike_expo: i32,
    pub collateral_mint: Pubkey,
    pub expiry: i64,
    pub is_private: bool,
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub side: u8,
    pub amount: u64,
    pub yes_pool: u64,
    pub no_pool: u64,
}

#[event]
pub struct BetCancelled {
    pub market: Pubkey,
    pub bettor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PriceSampled {
    pub market: Pubkey,
    pub price: i64,
    pub slot: u64,
    pub samples_so_far: u32,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub winning_side: u8,
    pub final_twap: i64,
    pub total_pool: u64,
    pub yes_pool: u64,
    pub no_pool: u64,
}

#[event]
pub struct PayoutClaimed {
    pub market: Pubkey,
    pub claimant: Pubkey,
    pub amount: u64,
    pub side: u8,
}

#[event]
pub struct RoomAccessGranted {
    pub market: Pubkey,
    pub user: Pubkey,
    pub fee_paid: u64,
}

#[event]
pub struct RwaMinted {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub rwa_type: String,
    pub supply: u64,
}
