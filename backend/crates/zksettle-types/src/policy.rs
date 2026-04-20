use serde::{Deserialize, Serialize};

use crate::Pubkey;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[non_exhaustive]
pub struct Policy {
    pub issuer: Pubkey,
    pub allowed_jurisdictions: Vec<String>,
    pub max_transfer_amount: Option<u64>,
    pub min_transfer_amount: Option<u64>,
}
