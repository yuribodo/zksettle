//! Off-chain mirrors of Anchor events emitted by the `zksettle` program.
//!
//! Anchor events are Borsh-encoded inside a program log entry. Indexers
//! (issue #22) decode the event payload into these structs using Borsh.

use borsh::{BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};

use crate::{Hash32, Pubkey};

/// Mirror of the `ProofSettled` event emitted by `verify_proof` on a
/// successful proof verification. Field order matches the on-chain event in
/// `backend/programs/zksettle/src/instructions/verify_proof.rs`.
#[derive(
    Clone, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize,
)]
pub struct ProofSettled {
    pub issuer: Pubkey,
    pub nullifier_hash: Hash32,
    pub merkle_root: Hash32,
    pub slot: u64,
    pub payer: Pubkey,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Serialized size of the Anchor event payload (no discriminator here —
    /// Anchor events are prefixed by an 8-byte discriminator in the program
    /// log entry, but the payload itself is just the Borsh-encoded fields).
    const EXPECTED_PAYLOAD_LEN: usize = 32 + 32 + 32 + 8 + 32;

    #[test]
    fn proof_settled_borsh_roundtrip() {
        let original = ProofSettled {
            issuer: [9u8; 32],
            nullifier_hash: [8u8; 32],
            merkle_root: [7u8; 32],
            slot: 1_234,
            payer: [6u8; 32],
        };
        let bytes = borsh::to_vec(&original).expect("serialize");
        assert_eq!(bytes.len(), EXPECTED_PAYLOAD_LEN);
        let decoded = ProofSettled::try_from_slice(&bytes).expect("deserialize");
        assert_eq!(decoded, original);
    }
}
