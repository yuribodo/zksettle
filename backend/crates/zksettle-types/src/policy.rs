//! Compliance policy attached to each credential.
//!
//! Kept deliberately small for the hackathon MVP (PRD §9 lists multi-
//! jurisdiction and rich policy engines as out-of-scope). ADR-014 calls for
//! a fuller policy engine post-hackathon; keep new fields additive so
//! existing JSON payloads keep deserializing.

use serde::{Deserialize, Serialize};

use crate::Pubkey;

/// Rules a transfer must satisfy for a credential's attestation to be
/// accepted by downstream programs.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Policy {
    /// Issuer that owns this policy.
    pub issuer: Pubkey,

    /// ISO-3166 alpha-2 country codes the issuer accepts. An empty list
    /// means "no jurisdiction restriction."
    pub allowed_jurisdictions: Vec<String>,

    /// Maximum transfer amount in the smallest token unit (e.g. lamports for
    /// a 9-decimal mint). `None` means no ceiling.
    pub max_transfer_amount: Option<u64>,

    /// Minimum transfer amount in the smallest token unit. `None` means
    /// no floor.
    pub min_transfer_amount: Option<u64>,
}
