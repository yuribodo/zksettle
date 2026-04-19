use anchor_lang::prelude::*;

pub const ATTESTATION_SEED: &[u8] = b"attestation";

#[account]
pub struct Attestation {
    pub issuer: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub slot: u64,
    pub payer: Pubkey,
    pub bump: u8,
}

impl Attestation {
    // issuer (32) + nullifier_hash (32) + merkle_root (32) + slot (8) + payer (32) + bump (1)
    pub const LEN: usize = 32 + 32 + 32 + 8 + 32 + 1;
}
