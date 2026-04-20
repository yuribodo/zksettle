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
