//! Off-chain mirrors of the Anchor account layouts in
//! `backend/programs/zksettle/src/state/`. Field order and types are chosen
//! so the Borsh byte representation matches the on-chain format.
//!
//! `CompressedNullifier` and `CompressedAttestation` mirror Light Protocol
//! compressed accounts — they carry no Anchor discriminator and are not
//! rent-funded PDAs.

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

/// Off-chain mirror of the on-chain `CompressedNullifier` Light-compressed account.
///
/// Carries no data — its mere existence at the derived compressed address
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
pub struct CompressedNullifier;

/// Off-chain mirror of the on-chain `CompressedAttestation` Light-compressed
/// account written by `verify_proof` on successful verification.
///
/// Field order matches `backend/programs/zksettle/src/state/compressed.rs`.
#[derive(
    Clone, Debug, Default, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize,
)]
pub struct CompressedAttestation {
    pub issuer: Pubkey,
    pub nullifier_hash: Hash32,
    pub merkle_root: Hash32,
    pub mint: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub epoch: u64,
    pub slot: u64,
    pub payer: Pubkey,
}

#[cfg(test)]
mod tests {
    use super::*;

    // Pinned to the on-chain layouts in `backend/programs/zksettle/src/state/`.
    // Any divergence fails CI and forces both sides to stay in sync.
    const ON_CHAIN_ISSUER_LEN: usize = 73;
    const ON_CHAIN_COMPRESSED_ATTESTATION_PAYLOAD_LEN: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 32;

    #[test]
    fn issuer_len_matches_on_chain() {
        assert_eq!(Issuer::LEN, ON_CHAIN_ISSUER_LEN);
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
    fn compressed_nullifier_borsh_roundtrip_is_zero_bytes() {
        let bytes = borsh::to_vec(&CompressedNullifier).expect("serialize");
        assert_eq!(bytes.len(), 0);
        CompressedNullifier::try_from_slice(&bytes).expect("deserialize");
    }

    #[test]
    fn compressed_attestation_borsh_roundtrip_preserves_layout() {
        let original = CompressedAttestation {
            issuer: [3u8; 32],
            nullifier_hash: [4u8; 32],
            merkle_root: [5u8; 32],
            mint: [6u8; 32],
            recipient: [7u8; 32],
            amount: 1_000_000,
            epoch: 42,
            slot: 123_456,
            payer: [8u8; 32],
        };
        let bytes = borsh::to_vec(&original).expect("serialize");
        assert_eq!(bytes.len(), ON_CHAIN_COMPRESSED_ATTESTATION_PAYLOAD_LEN);
        let decoded = CompressedAttestation::try_from_slice(&bytes).expect("deserialize");
        assert_eq!(decoded, original);
    }
}
