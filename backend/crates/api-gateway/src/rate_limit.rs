use std::num::NonZeroU32;
use std::sync::Arc;

use dashmap::DashMap;
use governor::clock::DefaultClock;
use governor::state::{InMemoryState, NotKeyed};
use governor::{Quota, RateLimiter};
use zksettle_types::gateway::Tier;

type Limiter = RateLimiter<NotKeyed, InMemoryState, DefaultClock>;

#[derive(Default)]
pub struct RateLimitStore {
    limiters: DashMap<String, Arc<Limiter>>,
}

impl RateLimitStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn check(&self, key_hash: &str, tier: Tier) -> bool {
        let compound_key = format!("{key_hash}:{tier}");
        let limiter = self
            .limiters
            .entry(compound_key)
            .or_insert_with(|| Arc::new(build_limiter(tier)))
            .clone();
        limiter.check().is_ok()
    }
}

fn build_limiter(tier: Tier) -> Limiter {
    let per_second = match tier {
        Tier::Developer => 1,
        Tier::Startup => 10,
        Tier::Growth => 50,
        Tier::Enterprise => 200,
    };
    let quota = Quota::per_second(NonZeroU32::new(per_second).unwrap());
    RateLimiter::direct(quota)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_within_limit() {
        let store = RateLimitStore::new();
        assert!(store.check("k1", Tier::Developer));
    }

    #[test]
    fn blocks_after_burst() {
        let store = RateLimitStore::new();
        // Developer tier: 1/sec, burst of 1
        let first = store.check("k1", Tier::Developer);
        assert!(first);
        // Rapid second call should be blocked
        let second = store.check("k1", Tier::Developer);
        assert!(!second);
    }

    #[test]
    fn separate_keys_independent() {
        let store = RateLimitStore::new();
        assert!(store.check("k1", Tier::Developer));
        assert!(store.check("k2", Tier::Developer));
    }
}
