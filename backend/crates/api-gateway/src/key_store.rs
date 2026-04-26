use dashmap::DashMap;
use sha2::{Digest, Sha256};
use zksettle_types::gateway::{ApiKeyRecord, Tier};

#[derive(Default)]
pub struct KeyStore {
    keys: DashMap<String, ApiKeyRecord>,
}

impl KeyStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&self, raw_key: &str, owner: String, tier: Tier, created_at: u64) {
        let hash = hash_key(raw_key);
        self.keys.insert(
            hash.clone(),
            ApiKeyRecord {
                key_hash: hash,
                tier,
                owner,
                created_at,
            },
        );
    }

    pub fn lookup(&self, raw_key: &str) -> Option<ApiKeyRecord> {
        let hash = hash_key(raw_key);
        self.keys.get(&hash).map(|r| r.clone())
    }

    pub fn lookup_by_hash(&self, key_hash: &str) -> Option<ApiKeyRecord> {
        self.keys.get(key_hash).map(|r| r.clone())
    }

    pub fn remove(&self, raw_key: &str) -> bool {
        let hash = hash_key(raw_key);
        self.keys.remove(&hash).is_some()
    }

    pub fn remove_by_hash(&self, key_hash: &str) -> bool {
        self.keys.remove(key_hash).is_some()
    }

    pub fn list(&self) -> Vec<ApiKeyRecord> {
        self.keys.iter().map(|r| r.value().clone()).collect()
    }
}

pub fn hash_key(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn generate_key() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::rng().random();
    format!("zks_{}", hex::encode(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_and_lookup() {
        let store = KeyStore::new();
        store.insert("test-key", "alice".into(), Tier::Developer, 1000);
        let record = store.lookup("test-key").unwrap();
        assert_eq!(record.owner, "alice");
        assert_eq!(record.tier, Tier::Developer);
    }

    #[test]
    fn lookup_missing_returns_none() {
        let store = KeyStore::new();
        assert!(store.lookup("nonexistent").is_none());
    }

    #[test]
    fn remove_key() {
        let store = KeyStore::new();
        store.insert("key", "bob".into(), Tier::Startup, 2000);
        assert!(store.remove("key"));
        assert!(store.lookup("key").is_none());
    }

    #[test]
    fn remove_by_hash_returns_false_when_unknown() {
        let store = KeyStore::new();
        assert!(!store.remove_by_hash("0".repeat(64).as_str()));
    }

    #[test]
    fn remove_by_hash_evicts_existing() {
        let store = KeyStore::new();
        store.insert("k", "owner".into(), Tier::Developer, 1);
        let hash = hash_key("k");
        assert!(store.remove_by_hash(&hash));
        assert!(store.lookup("k").is_none());
    }

    #[test]
    fn list_returns_all_records() {
        let store = KeyStore::new();
        store.insert("a", "alice".into(), Tier::Developer, 100);
        store.insert("b", "bob".into(), Tier::Startup, 200);
        let mut owners: Vec<String> = store.list().into_iter().map(|r| r.owner).collect();
        owners.sort();
        assert_eq!(owners, vec!["alice".to_string(), "bob".to_string()]);
    }

    #[test]
    fn generated_key_has_prefix() {
        let key = generate_key();
        assert!(key.starts_with("zks_"));
        assert_eq!(key.len(), 4 + 64); // "zks_" + 32 bytes hex
    }

    #[test]
    fn hash_is_deterministic() {
        assert_eq!(hash_key("abc"), hash_key("abc"));
        assert_ne!(hash_key("abc"), hash_key("def"));
    }
}
