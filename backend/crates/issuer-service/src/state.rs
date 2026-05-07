use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use ark_bn254::Fr;
use zksettle_crypto::{MerkleTree, SparseMerkleTree, poseidon2_hash};

use crate::convert::fr_to_bytes_be;

pub type SharedState = Arc<RwLock<IssuerState>>;
pub type PublishLock = Arc<Mutex<()>>;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct CredentialRecord {
    pub wallet: [u8; 32],
    pub leaf_index: usize,
    pub jurisdiction: String,
    pub issued_at: u64,
    #[serde(default)]
    pub revoked: bool,
}

pub struct IssuerState {
    pub membership_tree: MerkleTree,
    pub sanctions_tree: SparseMerkleTree,
    pub jurisdiction_tree: MerkleTree,
    pub credentials: HashMap<[u8; 32], CredentialRecord>,
    pub last_publish_slot: u64,
    pub registered: bool,
    pub roots_dirty: bool,
}

impl IssuerState {
    pub fn new() -> Self {
        let mut jurisdiction_tree = MerkleTree::new();
        jurisdiction_tree.insert(poseidon2_hash(&[Fr::from(1u64)]));

        Self {
            membership_tree: MerkleTree::new(),
            sanctions_tree: SparseMerkleTree::new(),
            jurisdiction_tree,
            credentials: HashMap::new(),
            last_publish_slot: 0,
            registered: false,
            roots_dirty: false,
        }
    }

    pub fn roots_as_bytes(&self) -> ([u8; 32], [u8; 32], [u8; 32]) {
        (
            fr_to_bytes_be(&self.membership_tree.root()),
            fr_to_bytes_be(&self.sanctions_tree.root()),
            fr_to_bytes_be(&self.jurisdiction_tree.root()),
        )
    }

    pub fn wallet_count(&self) -> usize {
        self.credentials.len()
    }
}

impl Default for IssuerState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roots_as_bytes_deterministic() {
        let s1 = IssuerState::new();
        let s2 = IssuerState::new();
        assert_eq!(s1.roots_as_bytes(), s2.roots_as_bytes());
    }

    #[test]
    fn roots_as_bytes_not_trivial() {
        let s = IssuerState::new();
        let (m, san, j) = s.roots_as_bytes();
        assert_ne!(m, [0u8; 32], "empty merkle root must not be all zeros");
        assert_ne!(m, [1u8; 32]);
        assert_ne!(san, [0u8; 32], "empty sanctions root must not be all zeros");
        assert_ne!(san, [1u8; 32]);
        assert_ne!(j, [0u8; 32], "jurisdiction root must not be all zeros");
        assert_ne!(j, [1u8; 32]);
        assert_ne!(m, j, "seeded jurisdiction tree should differ from empty membership tree");
    }

    #[test]
    fn wallet_count_empty() {
        let s = IssuerState::new();
        assert_eq!(s.wallet_count(), 0);
    }

    #[test]
    fn wallet_count_after_insert() {
        let mut s = IssuerState::new();
        s.credentials.insert([1u8; 32], CredentialRecord {
            wallet: [1u8; 32],
            leaf_index: 0,
            jurisdiction: "US".into(),
            issued_at: 0,
            revoked: false,
        });
        assert_eq!(s.wallet_count(), 1);
    }

    #[test]
    fn default_equals_new() {
        let d = IssuerState::default();
        let n = IssuerState::new();
        assert_eq!(d.roots_as_bytes(), n.roots_as_bytes());
        assert_eq!(d.wallet_count(), n.wallet_count());
    }
}
