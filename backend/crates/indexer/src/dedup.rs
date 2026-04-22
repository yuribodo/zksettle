use std::time::Duration;

use moka::sync::Cache;

pub struct NullifierStore {
    seen: Cache<[u8; 32], ()>,
}

impl NullifierStore {
    pub fn new(capacity: u64, ttl: Duration) -> Self {
        Self {
            seen: Cache::builder()
                .max_capacity(capacity)
                .time_to_live(ttl)
                .build(),
        }
    }

    pub fn mark_uploaded(&self, nullifier: &[u8; 32]) {
        self.seen.insert(*nullifier, ());
    }

    pub fn contains(&self, nullifier: &[u8; 32]) -> bool {
        self.seen.contains_key(nullifier)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_store() -> NullifierStore {
        NullifierStore::new(1_000, Duration::from_secs(3600))
    }

    #[test]
    fn mark_uploaded_then_contains() {
        let store = test_store();
        let n = [1u8; 32];
        assert!(!store.contains(&n));
        store.mark_uploaded(&n);
        assert!(store.contains(&n));
    }

    #[test]
    fn duplicate_mark_is_idempotent() {
        let store = test_store();
        store.mark_uploaded(&[2u8; 32]);
        store.mark_uploaded(&[2u8; 32]);
        assert!(store.contains(&[2u8; 32]));
    }
}
