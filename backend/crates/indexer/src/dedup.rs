use std::path::Path;
use std::time::Duration;

use moka::sync::Cache;
use rocksdb::{Options, DB};

use crate::error::IndexerError;

pub struct NullifierStore {
    cache: Cache<[u8; 32], ()>,
    db: DB,
}

impl NullifierStore {
    pub fn open(path: &Path, capacity: u64, ttl: Duration) -> Result<Self, IndexerError> {
        let mut opts = Options::default();
        opts.create_if_missing(true);
        opts.set_compression_type(rocksdb::DBCompressionType::Lz4);

        let db = DB::open(&opts, path).map_err(|e| {
            IndexerError::Config(format!("failed to open dedup database at {}: {e}", path.display()))
        })?;

        let cache: Cache<[u8; 32], ()> = Cache::builder()
            .max_capacity(capacity)
            .time_to_live(ttl)
            .build();

        let start = std::time::Instant::now();
        let iter = db.iterator(rocksdb::IteratorMode::Start);
        let mut warmed = 0u64;
        let mut skipped = 0u64;
        for item in iter {
            let (key, _) = item.map_err(|e| {
                IndexerError::Config(format!("failed reading dedup db during warmup: {e}"))
            })?;
            if key.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&key);
                cache.insert(arr, ());
                warmed += 1;
                if warmed >= capacity {
                    break;
                }
            } else {
                skipped += 1;
                tracing::warn!(key_len = key.len(), "unexpected key size in dedup db, skipping");
            }
        }

        tracing::info!(warmed, skipped, elapsed_ms = start.elapsed().as_millis() as u64, "dedup store opened");

        Ok(Self { cache, db })
    }

    pub fn mark_uploaded(&self, nullifier: &[u8; 32]) -> Result<(), IndexerError> {
        self.db.put(nullifier, b"").map_err(|e| {
            IndexerError::DedupWrite(format!("failed to persist nullifier: {e}"))
        })?;
        self.cache.insert(*nullifier, ());
        Ok(())
    }

    pub fn contains(&self, nullifier: &[u8; 32]) -> bool {
        if self.cache.contains_key(nullifier) {
            return true;
        }
        match self.db.get_pinned(nullifier) {
            Ok(Some(_)) => {
                self.cache.insert(*nullifier, ());
                true
            }
            Ok(None) => false,
            Err(e) => {
                tracing::warn!(error = %e, "dedup db read failed, treating as not-found");
                false
            }
        }
    }

    pub fn flush(&self) -> Result<(), IndexerError> {
        self.db.flush().map_err(|e| {
            IndexerError::DedupWrite(format!("failed to flush dedup db: {e}"))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_store(dir: &Path) -> NullifierStore {
        NullifierStore::open(dir, 1_000, Duration::from_secs(3600)).unwrap()
    }

    #[test]
    fn mark_uploaded_then_contains() {
        let tmp = tempfile::tempdir().unwrap();
        let store = test_store(tmp.path());
        let n = [1u8; 32];
        assert!(!store.contains(&n));
        store.mark_uploaded(&n).unwrap();
        assert!(store.contains(&n));
    }

    #[test]
    fn duplicate_mark_is_idempotent() {
        let tmp = tempfile::tempdir().unwrap();
        let store = test_store(tmp.path());
        store.mark_uploaded(&[2u8; 32]).unwrap();
        store.mark_uploaded(&[2u8; 32]).unwrap();
        assert!(store.contains(&[2u8; 32]));
    }

    #[test]
    fn persists_across_reopen() {
        let tmp = tempfile::tempdir().unwrap();
        let n = [3u8; 32];

        {
            let store = test_store(tmp.path());
            store.mark_uploaded(&n).unwrap();
            assert!(store.contains(&n));
        }

        let store = test_store(tmp.path());
        assert!(store.contains(&n), "nullifier should survive reopen");
    }

    #[test]
    fn cache_miss_falls_back_to_disk() {
        let tmp = tempfile::tempdir().unwrap();
        let n = [4u8; 32];

        // Write with capacity=1 so cache evicts fast
        let store = NullifierStore::open(tmp.path(), 1, Duration::from_secs(1)).unwrap();
        store.mark_uploaded(&n).unwrap();

        // Evict from cache by inserting another key and invalidating
        store.cache.invalidate_all();
        store.cache.run_pending_tasks();
        assert!(!store.cache.contains_key(&n), "cache should be empty after invalidation");

        // contains should hit disk and re-warm cache
        assert!(store.contains(&n), "should find nullifier on disk after cache miss");
        assert!(store.cache.contains_key(&n), "cache should be warm after disk hit");
    }
}
