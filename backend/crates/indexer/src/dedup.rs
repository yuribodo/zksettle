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

    /// Returns `true` if the nullifier was new, `false` if already seen.
    pub fn try_insert(&self, nullifier: &[u8; 32]) -> bool {
        self.seen.insert(*nullifier, ()).is_none()
    }

    pub fn contains(&self, nullifier: &[u8; 32]) -> bool {
        self.seen.contains_key(nullifier)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_new_returns_true() {
        let store = NullifierStore::new();
        assert!(store.try_insert(&[1u8; 32]));
    }

    #[test]
    fn insert_duplicate_returns_false() {
        let store = NullifierStore::new();
        assert!(store.try_insert(&[2u8; 32]));
        assert!(!store.try_insert(&[2u8; 32]));
    }

    #[test]
    fn contains_after_insert() {
        let store = NullifierStore::new();
        let n = [3u8; 32];
        assert!(!store.contains(&n));
        store.try_insert(&n);
        assert!(store.contains(&n));
    }
}
