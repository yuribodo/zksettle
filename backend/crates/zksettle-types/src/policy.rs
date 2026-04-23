#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

use crate::Pubkey;

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[non_exhaustive]
pub struct Policy {
    pub issuer: Pubkey,
    pub allowed_jurisdictions: Vec<String>,
    pub max_transfer_amount: Option<u64>,
    pub min_transfer_amount: Option<u64>,
}

impl Policy {
    pub fn new(issuer: Pubkey, allowed_jurisdictions: Vec<String>) -> Self {
        Self {
            issuer,
            allowed_jurisdictions,
            max_transfer_amount: None,
            min_transfer_amount: None,
        }
    }
}
