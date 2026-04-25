use dashmap::DashMap;
use zksettle_types::gateway::UsageRecord;

const PERIOD_SECS: u64 = 30 * 24 * 60 * 60; // 30 days

#[derive(Default)]
pub struct Metering {
    usage: DashMap<String, UsageRecord>,
}

impl Metering {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn increment(&self, key_hash: &str, now: u64) {
        self.usage
            .entry(key_hash.to_owned())
            .and_modify(|u| {
                if now - u.period_start >= PERIOD_SECS {
                    u.request_count = 1;
                    u.period_start = now;
                } else {
                    u.request_count += 1;
                }
                u.last_request = now;
            })
            .or_insert_with(|| {
                let mut r = UsageRecord::new(now);
                r.request_count = 1;
                r
            });
    }

    pub fn get(&self, key_hash: &str, now: u64) -> UsageRecord {
        match self.usage.get(key_hash) {
            Some(u) => {
                let u = u.clone();
                if now - u.period_start >= PERIOD_SECS {
                    UsageRecord::new(now)
                } else {
                    u
                }
            }
            None => UsageRecord::new(now),
        }
    }

    pub fn current_count(&self, key_hash: &str, now: u64) -> u64 {
        self.get(key_hash, now).request_count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn increment_from_zero() {
        let m = Metering::new();
        m.increment("k1", 1000);
        assert_eq!(m.current_count("k1", 1000), 1);
    }

    #[test]
    fn increment_accumulates() {
        let m = Metering::new();
        m.increment("k1", 1000);
        m.increment("k1", 1001);
        m.increment("k1", 1002);
        assert_eq!(m.current_count("k1", 1002), 3);
    }

    #[test]
    fn period_rollover_resets_count() {
        let m = Metering::new();
        m.increment("k1", 1000);
        m.increment("k1", 1001);
        let after_period = 1000 + PERIOD_SECS + 1;
        m.increment("k1", after_period);
        assert_eq!(m.current_count("k1", after_period), 1);
    }

    #[test]
    fn get_unknown_key_returns_zero() {
        let m = Metering::new();
        assert_eq!(m.current_count("unknown", 5000), 0);
    }

    #[test]
    fn period_boundary_exact() {
        let m = Metering::new();
        m.increment("k1", 0);
        let exactly_at = PERIOD_SECS;
        m.increment("k1", exactly_at);
        assert_eq!(m.current_count("k1", exactly_at), 1);
    }

    #[test]
    fn period_boundary_one_before() {
        let m = Metering::new();
        m.increment("k1", 0);
        let just_before = PERIOD_SECS - 1;
        m.increment("k1", just_before);
        assert_eq!(m.current_count("k1", just_before), 2);
    }

    #[test]
    fn get_returns_fresh_record_after_period() {
        let m = Metering::new();
        m.increment("k1", 0);
        m.increment("k1", 1);
        let after = PERIOD_SECS + 100;
        let rec = m.get("k1", after);
        assert_eq!(rec.request_count, 0);
        assert_eq!(rec.period_start, after);
    }

    #[test]
    fn last_request_updated() {
        let m = Metering::new();
        m.increment("k1", 100);
        m.increment("k1", 200);
        let rec = m.get("k1", 200);
        assert_eq!(rec.last_request, 200);
    }

    #[test]
    fn period_secs_is_30_days() {
        assert_eq!(PERIOD_SECS, 30 * 24 * 60 * 60);
    }

    #[test]
    fn subtraction_not_addition_in_period_check() {
        let m = Metering::new();
        let start = PERIOD_SECS / 2;
        m.increment("k1", start);
        let now = start + 1;
        m.increment("k1", now);
        assert_eq!(m.current_count("k1", now), 2, "should accumulate, not reset");
    }
}
