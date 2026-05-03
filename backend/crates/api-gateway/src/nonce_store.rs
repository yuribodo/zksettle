use std::time::{Duration, Instant};

use dashmap::DashMap;
use rand::Rng;

const NONCE_TTL: Duration = Duration::from_secs(300);
const NONCE_LEN: usize = 16;

pub struct NonceStore {
    pending: DashMap<String, Instant>,
}

impl NonceStore {
    pub fn new() -> Self {
        Self {
            pending: DashMap::new(),
        }
    }

    pub fn issue(&self) -> String {
        let nonce: String = rand::rng()
            .sample_iter(&rand::distr::Alphanumeric)
            .take(NONCE_LEN)
            .map(char::from)
            .collect();
        self.pending.insert(nonce.clone(), Instant::now());
        nonce
    }

    pub fn consume(&self, nonce: &str) -> bool {
        match self.pending.remove(nonce) {
            Some((_, created)) => created.elapsed() < NONCE_TTL,
            None => false,
        }
    }

    pub fn evict_expired(&self) {
        self.pending.retain(|_, created| created.elapsed() < NONCE_TTL);
    }

    pub fn spawn_cleanup(&self)
    where
        Self: Send + Sync + 'static,
    {
        let pending = self.pending.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                pending.retain(|_, created| created.elapsed() < NONCE_TTL);
            }
        });
    }
}

impl Default for NonceStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issue_returns_alphanumeric() {
        let store = NonceStore::new();
        let nonce = store.issue();
        assert_eq!(nonce.len(), NONCE_LEN);
        assert!(nonce.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn consume_valid_nonce() {
        let store = NonceStore::new();
        let nonce = store.issue();
        assert!(store.consume(&nonce));
    }

    #[test]
    fn consume_rejects_reuse() {
        let store = NonceStore::new();
        let nonce = store.issue();
        assert!(store.consume(&nonce));
        assert!(!store.consume(&nonce));
    }

    #[test]
    fn consume_rejects_unknown() {
        let store = NonceStore::new();
        assert!(!store.consume("not_a_real_nonce"));
    }
}
