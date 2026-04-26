#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "lowercase"))]
pub enum Tier {
    Developer,
    Startup,
    Growth,
    Enterprise,
}

impl Tier {
    pub fn monthly_limit(self) -> u64 {
        match self {
            Self::Developer => 1_000,
            Self::Startup => 10_000,
            Self::Growth => 100_000,
            Self::Enterprise => 1_000_000,
        }
    }

    pub fn price_cents(self) -> u64 {
        match self {
            Self::Developer => 0,
            Self::Startup => 4_900,
            Self::Growth => 19_900,
            Self::Enterprise => 49_900,
        }
    }
}

impl std::fmt::Display for Tier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Developer => write!(f, "developer"),
            Self::Startup => write!(f, "startup"),
            Self::Growth => write!(f, "growth"),
            Self::Enterprise => write!(f, "enterprise"),
        }
    }
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ApiKeyRecord {
    pub key_hash: String,
    pub tier: Tier,
    pub owner: String,
    pub created_at: u64,
}

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct UsageRecord {
    pub request_count: u64,
    pub period_start: u64,
    pub last_request: u64,
}

impl UsageRecord {
    pub fn new(now: u64) -> Self {
        Self {
            request_count: 0,
            period_start: now,
            last_request: now,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct DailyUsage {
    /// `YYYY-MM-DD` (UTC).
    pub date: String,
    pub count: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tier_monthly_limit_values() {
        assert_eq!(Tier::Developer.monthly_limit(), 1_000);
        assert_eq!(Tier::Startup.monthly_limit(), 10_000);
        assert_eq!(Tier::Growth.monthly_limit(), 100_000);
        assert_eq!(Tier::Enterprise.monthly_limit(), 1_000_000);
    }

    #[test]
    fn tier_monthly_limit_strictly_increases_by_tier() {
        assert!(Tier::Developer.monthly_limit() < Tier::Startup.monthly_limit());
        assert!(Tier::Startup.monthly_limit() < Tier::Growth.monthly_limit());
        assert!(Tier::Growth.monthly_limit() < Tier::Enterprise.monthly_limit());
    }

    #[test]
    fn tier_price_cents_values() {
        assert_eq!(Tier::Developer.price_cents(), 0);
        assert_eq!(Tier::Startup.price_cents(), 4_900);
        assert_eq!(Tier::Growth.price_cents(), 19_900);
        assert_eq!(Tier::Enterprise.price_cents(), 49_900);
    }

    #[test]
    fn tier_display_uses_lowercase_variant_name() {
        assert_eq!(Tier::Developer.to_string(), "developer");
        assert_eq!(Tier::Startup.to_string(), "startup");
        assert_eq!(Tier::Growth.to_string(), "growth");
        assert_eq!(Tier::Enterprise.to_string(), "enterprise");
    }

    #[test]
    fn usage_record_new_starts_counters_at_zero() {
        let now = 1_700_000_000;
        let rec = UsageRecord::new(now);
        assert_eq!(rec.request_count, 0);
        assert_eq!(rec.period_start, now);
        assert_eq!(rec.last_request, now);
    }
}
