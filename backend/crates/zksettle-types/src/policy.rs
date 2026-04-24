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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_defaults_transfer_bounds_to_none() {
        let policy = Policy::new([0u8; 32], vec!["US".into()]);
        assert_eq!(policy.max_transfer_amount, None);
        assert_eq!(policy.min_transfer_amount, None);
    }

    #[test]
    fn new_preserves_issuer_and_jurisdictions() {
        let issuer = [7u8; 32];
        let allowed = vec!["US".to_string(), "EU".to_string()];
        let policy = Policy::new(issuer, allowed.clone());
        assert_eq!(policy.issuer, issuer);
        assert_eq!(policy.allowed_jurisdictions, allowed);
    }
}
