use anchor_lang::prelude::*;

#[account]
pub struct RedemptionRequest {
    pub holder: Pubkey,
    pub treasury: Pubkey,
    pub mint: Pubkey,
    pub token_account: Pubkey,
    pub amount: u64,
    pub nonce: u64,
    pub requested_at: i64,
    pub bump: u8,
}

impl RedemptionRequest {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1;
}
