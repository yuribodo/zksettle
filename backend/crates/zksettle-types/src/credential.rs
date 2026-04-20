//! Credential schema — what an issuer signs for a user after KYC.
//!
//! Credentials never live on-chain in their raw form; only their Poseidon
//! commitment does (as a leaf of the issuer's Merkle tree). Off-chain
//! services transport credentials as JSON, which is why this module only
//! derives `serde` traits and not `borsh`.

use serde::{Deserialize, Serialize};

use crate::{Hash32, Pubkey};

/// A compliance credential issued by a KYC provider after vetting a user.
///
/// The Poseidon commitment of this struct is what lands in the issuer's
/// Merkle tree and later gets proven privately inside the Noir circuit.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Credential {
    /// Credential schema version — exposed as a public input per ADR-010 so
    /// the program can enforce which schema versions are currently accepted.
    pub schema_version: u32,

    /// Solana wallet the credential is bound to.
    pub wallet: Pubkey,

    /// ISO-3166 alpha-2 country code (e.g. "US", "BR"). Hashed into a
    /// jurisdiction set per ADR-013.
    pub jurisdiction: String,

    /// Unix timestamp (seconds) after which the credential must be rejected.
    pub expiry: u64,

    /// True if the user cleared the issuer's sanctions screening at issuance.
    pub sanctions_clear: bool,
}

/// Poseidon hash of a `Credential`, used as the leaf value in the issuer's
/// Merkle tree. The Poseidon implementation lives in the separate
/// `zksettle-crypto` crate (issue #20); this is just the type alias consumers
/// use when they need to name "the commitment."
pub type CredentialCommitment = Hash32;
