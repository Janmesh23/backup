use anchor_lang::prelude::*;

#[account]
pub struct RoomAccess {
    pub market: Pubkey,
    pub user: Pubkey,
    pub paid_at: i64,
    pub fee_paid: u64,
    pub bump: u8,
}

impl RoomAccess {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}
