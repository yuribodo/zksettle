//! Off-chain mirrors of the Anchor account layouts defined in
//! `backend/programs/zksettle/src/state/`. Field order and types are chosen to
//! match the on-chain Borsh byte representation exactly so off-chain services
//! can decode raw account data fetched from the RPC.
//!
//! The `LEN` constants mirror the program-side values and do **not** include
//! the 8-byte Anchor discriminator that prefixes every Anchor account.

use borsh::{BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};

use crate::{Hash32, Pubkey};

/// Off-chain mirror of the on-chain `Issuer` account.
///
/// Layout: `authority (32) + merkle_root (32) + root_slot (8) + bump (1)` = 73 bytes.
#[derive(Clone, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
pub struct Issuer {
    pub authority: Pubkey,
    pub merkle_root: Hash32,
    pub root_slot: u64,
    pub bump: u8,
}

impl Issuer {
    /// Payload size in bytes, excluding Anchor's 8-byte discriminator.
    pub const LEN: usize = 32 + 32 + 8 + 1;
}

/// Off-chain mirror of the on-chain `Nullifier` marker account.
///
/// The account carries no data — its mere existence at the derived PDA
/// proves the nullifier has been spent for the bound issuer.
#[derive(
    Clone,
    Copy,
    Debug,
    Default,
    PartialEq,
    Eq,
    BorshSerialize,
    BorshDeserialize,
    Serialize,
    Deserialize,
)]
pub struct Nullifier;

impl Nullifier {
    pub const LEN: usize = 0;
}

/// Off-chain mirror of the on-chain `Attestation` account written by
/// `verify_proof` on successful verification.
///
/// Layout: `issuer (32) + nullifier_hash (32) + merkle_root (32) + slot (8)
/// + payer (32) + bump (1)` = 137 bytes.
#[derive(Clone, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
pub struct Attestation {
    pub issuer: Pubkey,
    pub nullifier_hash: Hash32,
    pub merkle_root: Hash32,
    pub slot: u64,
    pub payer: Pubkey,
    pub bump: u8,
}

impl Attestation {
    /// Payload size in bytes, excluding Anchor's 8-byte discriminator.
    pub const LEN: usize = 32 + 32 + 32 + 8 + 32 + 1;
}

#[cfg(test)]
mod tests {
    use super::*;

    // These length constants are pinned to the on-chain layout in
    // `backend/programs/zksettle/src/state/`. If the program side changes,
    // these tests will fail and the mirror MUST be updated to match.
    const ON_CHAIN_ISSUER_LEN: usize = 73;
    const ON_CHAIN_ATTESTATION_LEN: usize = 137;
    const ON_CHAIN_NULLIFIER_LEN: usize = 0;

    #[test]
    fn issuer_len_matches_on_chain() {
        assert_eq!(Issuer::LEN, ON_CHAIN_ISSUER_LEN);
    }

    #[test]
    fn nullifier_len_matches_on_chain() {
        assert_eq!(Nullifier::LEN, ON_CHAIN_NULLIFIER_LEN);
    }

    #[test]
    fn attestation_len_matches_on_chain() {
        assert_eq!(Attestation::LEN, ON_CHAIN_ATTESTATION_LEN);
    }

    #[test]
    fn issuer_borsh_roundtrip_preserves_layout() {
        let original = Issuer {
            authority: [1u8; 32],
            merkle_root: [2u8; 32],
            root_slot: 0x0123_4567_89ab_cdef,
            bump: 255,
        };
        let bytes = borsh::to_vec(&original).expect("serialize");
        assert_eq!(bytes.len(), Issuer::LEN);
        let decoded = Issuer::try_from_slice(&bytes).expect("deserialize");
        assert_eq!(decoded, original);
    }

    #[test]
    fn attestation_borsh_roundtrip_preserves_layout() {
        let original = Attestation {
            issuer: [3u8; 32],
            nullifier_hash: [4u8; 32],
            merkle_root: [5u8; 32],
            slot: 42,
            payer: [6u8; 32],
            bump: 7,
        };
        let bytes = borsh::to_vec(&original).expect("serialize");
        assert_eq!(bytes.len(), Attestation::LEN);
        let decoded = Attestation::try_from_slice(&bytes).expect("deserialize");
        assert_eq!(decoded, original);
    }
}
