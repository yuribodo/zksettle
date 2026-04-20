use serde::{Deserialize, Serialize};

use crate::{Hash32, Pubkey};

/// Signed after KYC. Transported as JSON; only its Poseidon commitment
/// lands on-chain (as a leaf of the issuer's Merkle tree).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Credential {
    pub schema_version: u32,
    pub wallet: Pubkey,
    pub jurisdiction: String,
    pub expiry: u64,
    pub sanctions_clear: bool,
}

pub type CredentialCommitment = Hash32;
