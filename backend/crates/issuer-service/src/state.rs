use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use zksettle_crypto::{MerkleTree, SparseMerkleTree};

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
        Self {
            membership_tree: MerkleTree::new(),
            sanctions_tree: SparseMerkleTree::new(),
            jurisdiction_tree: MerkleTree::new(),
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
