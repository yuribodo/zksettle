use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use governor::clock::DefaultClock;
use governor::state::{InMemoryState, NotKeyed};
use governor::state::keyed::DashMapStateStore;
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

pub struct LoginRateLimiter {
    limiter: Arc<RateLimiter<String, DashMapStateStore<String>, DefaultClock>>,
}

impl LoginRateLimiter {
    pub fn new() -> Self {
        Self::with_per_minute(5)
    }

    pub fn with_per_minute(n: u32) -> Self {
        let quota = Quota::per_minute(NonZeroU32::new(n.max(1)).unwrap());
        Self {
            limiter: Arc::new(RateLimiter::dashmap(quota)),
        }
    }

    pub fn check(&self, ip: &str) -> bool {
        self.limiter.check_key(&ip.to_owned()).is_ok()
    }

    pub fn spawn_cleanup(self: &Arc<Self>) {
        let limiter = Arc::clone(&self.limiter);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(300));
            loop {
                interval.tick().await;
                limiter.retain_recent();
            }
        });
    }
}

impl Default for LoginRateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

fn build_limiter(tier: Tier) -> Limiter {
    let per_second = match tier {
        Tier::Developer => 10,
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
        // Developer tier: 10/sec — exhaust the burst then verify block
        for _ in 0..10 {
            assert!(store.check("k1", Tier::Developer));
        }
        assert!(!store.check("k1", Tier::Developer));
    }

    #[test]
    fn separate_keys_independent() {
        let store = RateLimitStore::new();
        assert!(store.check("k1", Tier::Developer));
        assert!(store.check("k2", Tier::Developer));
    }
}
