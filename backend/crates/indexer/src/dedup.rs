use dashmap::DashMap;

pub struct NullifierStore {
    seen: DashMap<[u8; 32], ()>,
}

impl Default for NullifierStore {
    fn default() -> Self {
        Self::new()
    }
}

impl NullifierStore {
    pub fn new() -> Self {
        Self {
            seen: DashMap::new(),
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

    #[test]
    fn mark_uploaded_then_contains() {
        let store = NullifierStore::new();
        let n = [1u8; 32];
        assert!(!store.contains(&n));
        store.mark_uploaded(&n);
        assert!(store.contains(&n));
    }

    #[test]
    fn duplicate_mark_is_idempotent() {
        let store = NullifierStore::new();
        store.mark_uploaded(&[2u8; 32]);
        store.mark_uploaded(&[2u8; 32]);
        assert!(store.contains(&[2u8; 32]));
    }
}
