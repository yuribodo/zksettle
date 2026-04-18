use anchor_lang::prelude::*;

/// Discriminator-only marker account. Its mere existence at
/// `[NULLIFIER_SEED, issuer_pubkey, nullifier_hash]` proves the nullifier has
/// been spent for that issuer; Anchor's `init` constraint guarantees one-shot
/// uniqueness per (issuer, nullifier) pair.
#[account]
pub struct Nullifier {}

impl Nullifier {
    pub const LEN: usize = 0;
}
