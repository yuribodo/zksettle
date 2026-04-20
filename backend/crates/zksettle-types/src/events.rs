//! Off-chain mirrors of Anchor events emitted by the `zksettle` program.
//!
//! Anchor events are Borsh-encoded in program log entries. Indexers decode
//! those payloads into these structs.

use borsh::{BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};

use crate::{Hash32, Pubkey};

/// Mirror of the `ProofSettled` event emitted by `verify_proof` on a
/// successful proof verification. Field order matches the on-chain event in
/// `backend/programs/zksettle/src/instructions/verify_proof.rs`.
#[derive(Clone, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
pub struct ProofSettled {
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

/// Mirror of the `AttestationChecked` event emitted by `check_attestation`.
/// Field order matches the on-chain event in
/// `backend/programs/zksettle/src/instructions/check_attestation.rs`.
#[derive(Clone, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
pub struct AttestationChecked {
    pub issuer: Pubkey,
    pub nullifier_hash: Hash32,
    pub slot: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROOF_SETTLED_PAYLOAD_LEN: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 32;
    const ATTESTATION_CHECKED_PAYLOAD_LEN: usize = 32 + 32 + 8;

    #[test]
    fn proof_settled_borsh_roundtrip() {
        let original = ProofSettled {
            issuer: [9u8; 32],
            nullifier_hash: [8u8; 32],
            merkle_root: [7u8; 32],
            mint: [5u8; 32],
            recipient: [4u8; 32],
            amount: 2_500_000,
            epoch: 7,
            slot: 1_234,
            payer: [6u8; 32],
        };
        let bytes = borsh::to_vec(&original).expect("serialize");
        assert_eq!(bytes.len(), PROOF_SETTLED_PAYLOAD_LEN);
        let decoded = ProofSettled::try_from_slice(&bytes).expect("deserialize");
        assert_eq!(decoded, original);
    }

    #[test]
    fn attestation_checked_borsh_roundtrip() {
        let original = AttestationChecked {
            issuer: [1u8; 32],
            nullifier_hash: [2u8; 32],
            slot: 999,
        };
        let bytes = borsh::to_vec(&original).expect("serialize");
        assert_eq!(bytes.len(), ATTESTATION_CHECKED_PAYLOAD_LEN);
        let decoded = AttestationChecked::try_from_slice(&bytes).expect("deserialize");
        assert_eq!(decoded, original);
    }
}
