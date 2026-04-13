use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Market {
    // Creator and identity
    pub creator: Pubkey,          // 32
    pub market_id: u64,           // 8
    // Oracle config
    pub pyth_feed: Pubkey,        // 32 — Pyth price feed address
    pub strike_price: i64,        // 8 — strike in Pyth's native i64
    pub strike_expo: i32,         // 4 — exponent from Pyth
    // Collateral
    pub collateral_mint: Pubkey,  // 32 — Token 2022 mint
    // Timing
    pub created_at: i64,          // 8
    pub expiry: i64,              // 8 — unix timestamp
    // Pools
    pub yes_pool: u64,            // 8 — total YES collateral
    pub no_pool: u64,             // 8 — total NO collateral
    // TWAP accumulation
    pub twap_accumulator: i128,   // 16
    pub twap_samples: u32,        // 4
    pub twap_window_start: i64,   // 8
    pub last_sampled_slot: u64,   // 8 — prevent same-slot double sampling
    // Resolution
    pub winning_side: u8,         // 1 — 0 = unresolved, 1 = YES, 2 = NO
    pub resolved: bool,           // 1
    pub final_twap: i64,          // 8 — stored for transparency
    // Access
    pub is_private: bool,         // 1
    pub room_fee_lamports: u64,   // 8 — fee to enter private market
    // Metadata
    pub title: String,            // 4 + 100 max
    pub bump: u8,                 // 1
}

impl Market {
    pub const LEN: usize = 8    // discriminator
        + 32 + 8 + 32 + 8 + 4 + 32 + 8 + 8
        + 8 + 8 + 16 + 4 + 8 + 8
        + 1 + 1 + 8 + 1 + 8
        + (4 + 100) + 1;

    pub fn total_pool(&self) -> u64 {
        self.yes_pool.saturating_add(self.no_pool)
    }
}
