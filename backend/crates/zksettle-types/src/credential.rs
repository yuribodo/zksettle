use serde::{Deserialize, Serialize};

use crate::{Hash32, Pubkey};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Credential {
    pub schema_version: u32,
    pub wallet: Pubkey,
    /// ISO 3166-1 alpha-2 country code (e.g. "US", "BR").
    pub jurisdiction: String,
    pub expiry: u64,
    pub sanctions_clear: bool,
}

pub type CredentialCommitment = Hash32;
