pub const MAX_ROOT_AGE_SLOTS: u64 = 432_000;

/// Tunable independently from root freshness for compliance-specific lifetimes.
pub const MAX_ATTESTATION_AGE_SLOTS: u64 = 432_000;

/// Core `MintV1` account metas (excluding Bubblegum program id passed separately).
pub const BUBBLEGUM_MINT_V1_ACCOUNT_COUNT: usize = 8;

/// Bubblegum concurrent tree parameters (valid per SPL account-compression table).
pub const BUBBLEGUM_MAX_DEPTH: u32 = 14;
pub const BUBBLEGUM_MAX_BUFFER_SIZE: u32 = 64;
