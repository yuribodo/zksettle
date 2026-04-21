//! Compressed-account data types for Light Protocol ZK Compression.
//!
//! These types replace the rent-funded `Nullifier` and `Attestation` PDAs.
//! All fields are plain byte arrays rather than `Pubkey` to stay on
//! light-sdk's `solana-pubkey` 2.x type (anchor-lang ships 3.x/4.x).
//! Serialization uses borsh 0.10.4 to match light-sdk's `AnchorSerialize`
//! alias when the `anchor` feature is disabled.

use borsh::{BorshDeserialize, BorshSerialize};
use light_sdk::LightDiscriminator;

#[derive(Clone, Debug, Default, LightDiscriminator, BorshSerialize, BorshDeserialize)]
pub struct CompressedNullifier {}

#[derive(Clone, Debug, Default, LightDiscriminator, BorshSerialize, BorshDeserialize)]
pub struct CompressedAttestation {
    pub issuer: [u8; 32],
    pub nullifier_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub mint: [u8; 32],
    pub recipient: [u8; 32],
    pub amount: u64,
    pub epoch: u64,
    pub slot: u64,
    pub payer: [u8; 32],
}

#[cfg(test)]
mod tests {
    use super::*;
    use borsh::{BorshDeserialize, BorshSerialize};

    #[test]
    fn nullifier_default_roundtrip() {
        let n = CompressedNullifier::default();
        let bytes = n.try_to_vec().unwrap();
        let n2 = CompressedNullifier::try_from_slice(&bytes).unwrap();
        assert_eq!(format!("{n:?}"), format!("{n2:?}"));
    }

    #[test]
    fn attestation_default_roundtrip() {
        let a = CompressedAttestation::default();
        let bytes = a.try_to_vec().unwrap();
        let a2 = CompressedAttestation::try_from_slice(&bytes).unwrap();
        assert_eq!(a2.amount, 0);
        assert_eq!(a2.epoch, 0);
        assert_eq!(a2.slot, 0);
    }

    #[test]
    fn attestation_serialization_stability() {
        let a = CompressedAttestation {
            issuer: [1u8; 32],
            nullifier_hash: [2u8; 32],
            merkle_root: [3u8; 32],
            mint: [4u8; 32],
            recipient: [5u8; 32],
            amount: 999,
            epoch: 42,
            slot: 12345,
            payer: [6u8; 32],
        };
        let bytes = a.try_to_vec().unwrap();
        let a2 = CompressedAttestation::try_from_slice(&bytes).unwrap();
        assert_eq!(a2.issuer, [1u8; 32]);
        assert_eq!(a2.nullifier_hash, [2u8; 32]);
        assert_eq!(a2.amount, 999);
        assert_eq!(a2.epoch, 42);
        assert_eq!(a2.slot, 12345);
        assert_eq!(a2.payer, [6u8; 32]);
    }
}
