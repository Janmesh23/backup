use anchor_lang::prelude::*;

#[account]
pub struct Position {
    pub owner: Pubkey,    // 32
    pub market: Pubkey,   // 32
    pub side: u8,         // 1 — 1 = YES, 2 = NO
    pub amount: u64,      // 8 — collateral deposited
    pub claimed: bool,    // 1
    pub created_at: i64,  // 8
    pub bump: u8,         // 1
}

impl Position {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1 + 8 + 1;
}
