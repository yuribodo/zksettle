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
#[derive(
    Clone, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize,
)]
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
#[derive(
    Clone, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize, Serialize, Deserialize,
)]
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
