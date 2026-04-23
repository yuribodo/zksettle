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
