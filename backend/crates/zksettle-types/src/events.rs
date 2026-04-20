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
