use std::collections::BTreeMap;

use dashmap::DashMap;
use zksettle_types::gateway::{DailyUsage, UsageRecord};

const PERIOD_SECS: u64 = 30 * 24 * 60 * 60; // 30 days
const DAY_SECS: u64 = 24 * 60 * 60;
/// Cap the per-key daily history to bound memory. ~1 year is plenty for a
/// 30-day rolling chart with headroom for late requests against past windows.
const MAX_DAILY_BUCKETS: usize = 400;

#[derive(Default)]
pub struct Metering {
    usage: DashMap<String, UsageRecord>,
    /// `key_hash` → `day_start_unix` → request count for that day.
    daily: DashMap<String, BTreeMap<u64, u64>>,
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

        let day = day_start(now);
        let mut bucket = self.daily.entry(key_hash.to_owned()).or_default();
        *bucket.entry(day).or_insert(0) += 1;
        prune_old_buckets(&mut bucket);
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

    /// Returns up to `days` daily-usage rows for `key_hash`, ending at today
    /// (UTC). Always exactly `days` entries, oldest first, zero-filled where
    /// no requests occurred. `days = 0` returns an empty vec.
    pub fn daily_history(&self, key_hash: &str, now: u64, days: u32) -> Vec<DailyUsage> {
        if days == 0 {
            return Vec::new();
        }
        let today = day_start(now);
        let counts = self
            .daily
            .get(key_hash)
            .map(|b| b.clone())
            .unwrap_or_default();

        let mut out = Vec::with_capacity(days as usize);
        for offset in (0..days as u64).rev() {
            let day = today.saturating_sub(offset * DAY_SECS);
            let count = counts.get(&day).copied().unwrap_or(0);
            out.push(DailyUsage {
                date: format_day(day),
                count,
            });
        }
        out
    }
}

fn day_start(unix_secs: u64) -> u64 {
    (unix_secs / DAY_SECS) * DAY_SECS
}

fn prune_old_buckets(bucket: &mut BTreeMap<u64, u64>) {
    while bucket.len() > MAX_DAILY_BUCKETS {
        if let Some((&oldest, _)) = bucket.iter().next() {
            bucket.remove(&oldest);
        } else {
            break;
        }
    }
}

/// Format a UTC day-start unix timestamp as `YYYY-MM-DD` using a
/// proleptic-Gregorian conversion. Avoids pulling in `chrono` for one helper.
fn format_day(day_start_unix: u64) -> String {
    let days_since_epoch = (day_start_unix / DAY_SECS) as i64;
    let (y, m, d) = civil_from_days(days_since_epoch);
    format!("{y:04}-{m:02}-{d:02}")
}

/// Howard Hinnant's `civil_from_days` (public domain) — converts days since
/// 1970-01-01 (UTC) to (year, month, day) on the proleptic Gregorian calendar.
fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64; // [0, 146097)
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399)
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365)
    let mp = (5 * doy + 2) / 153; // [0, 11)
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp.wrapping_sub(9) }; // [1, 12]
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
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

    #[test]
    fn daily_history_empty_for_unknown_key() {
        let m = Metering::new();
        let h = m.daily_history("nope", DAY_SECS * 100, 7);
        assert_eq!(h.len(), 7);
        assert!(h.iter().all(|d| d.count == 0));
    }

    #[test]
    fn daily_history_zero_days_returns_empty() {
        let m = Metering::new();
        assert!(m.daily_history("k", 0, 0).is_empty());
    }

    #[test]
    fn daily_history_groups_same_day() {
        let m = Metering::new();
        let now = DAY_SECS * 100 + 42; // arbitrary day, mid-day
        m.increment("k", now);
        m.increment("k", now + 10);
        m.increment("k", now + 999);
        let h = m.daily_history("k", now, 1);
        assert_eq!(h.len(), 1);
        assert_eq!(h[0].count, 3);
    }

    #[test]
    fn daily_history_separates_consecutive_days() {
        let m = Metering::new();
        let day0 = DAY_SECS * 200;
        m.increment("k", day0);
        m.increment("k", day0 + DAY_SECS); // next day
        m.increment("k", day0 + DAY_SECS); // same as above
        let h = m.daily_history("k", day0 + DAY_SECS, 2);
        // Oldest first.
        assert_eq!(h[0].count, 1);
        assert_eq!(h[1].count, 2);
    }

    #[test]
    fn daily_history_zero_fills_gaps() {
        let m = Metering::new();
        let day0 = DAY_SECS * 300;
        m.increment("k", day0);
        let h = m.daily_history("k", day0 + 3 * DAY_SECS, 5);
        assert_eq!(h.len(), 5);
        // day0 - 1, day0, day0+1, day0+2, day0+3 all relative to "now=day0+3"
        // → "now=day0+3" gets count=0, day0+2 →0, day0+1 →0, day0 →1, day0-1 →0
        let counts: Vec<u64> = h.iter().map(|d| d.count).collect();
        assert_eq!(counts, vec![0, 1, 0, 0, 0]);
    }

    #[test]
    fn daily_history_dates_are_iso() {
        let m = Metering::new();
        // 1970-01-01 00:00:00 UTC = 0
        let h = m.daily_history("k", 0, 1);
        assert_eq!(h[0].date, "1970-01-01");

        // 2026-04-25 00:00:00 UTC = unix 1_777_075_200
        let h = m.daily_history("k", 1_777_075_200, 1);
        assert_eq!(h[0].date, "2026-04-25");
    }

    #[test]
    fn day_start_truncates_to_midnight_utc() {
        assert_eq!(day_start(DAY_SECS + 5), DAY_SECS);
        assert_eq!(day_start(DAY_SECS - 1), 0);
        assert_eq!(day_start(DAY_SECS), DAY_SECS);
    }

    #[test]
    fn pruning_caps_stored_buckets() {
        let m = Metering::new();
        // Insert MAX_DAILY_BUCKETS + 5 distinct days.
        for i in 0..(MAX_DAILY_BUCKETS as u64 + 5) {
            m.increment("k", i * DAY_SECS);
        }
        let stored = m.daily.get("k").unwrap().len();
        assert_eq!(stored, MAX_DAILY_BUCKETS);
    }

    #[test]
    fn civil_from_days_known_dates() {
        // Days since 1970-01-01.
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(31), (1970, 2, 1));
        assert_eq!(civil_from_days(365), (1971, 1, 1));
        assert_eq!(civil_from_days(20_454), (2026, 1, 1));
        assert_eq!(civil_from_days(20_568), (2026, 4, 25));
    }
}
