use anchor_lang::prelude::*;

#[account]
pub struct Issuer {
    pub authority: Pubkey,
    pub merkle_root: [u8; 32],
    pub root_slot: u64,
    pub bump: u8,
}

impl Issuer {
    // authority (32) + merkle_root (32) + root_slot (8) + bump (1)
    pub const LEN: usize = 32 + 32 + 8 + 1;
}
