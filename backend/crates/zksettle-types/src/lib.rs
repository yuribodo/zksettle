//! Shared type definitions for ZKSettle.
//!
//! This crate is the single source of truth for data shapes that cross the
//! on-chain / off-chain boundary: account layouts, event payloads, credential
//! schemas, and policy types. Downstream crates (`issuer-service`, `indexer`,
//! `api-gateway`, `sanctions-updater`) and the TypeScript SDK depend on the
//! structures here so they cannot drift from the Anchor program.
//!
//! The crate intentionally carries no logic and no heavy Solana dependencies.
//! `Pubkey` is re-exported as a raw 32-byte alias so consumers pick their own
//! Solana SDK version; convert at the call site via `Pubkey::new_from_array`.

pub mod accounts;
pub mod credential;
pub mod error;
pub mod events;
pub mod policy;

pub use accounts::{Attestation, Issuer, Nullifier};
pub use credential::{Credential, CredentialCommitment};
pub use error::ZksettleError;
pub use events::ProofSettled;
pub use policy::Policy;

/// A Solana public key — 32 raw bytes. Matches the on-chain representation.
pub type Pubkey = [u8; 32];

/// A 32-byte hash output (Poseidon, Merkle root, nullifier hash, etc.).
pub type Hash32 = [u8; 32];

/// PDA seed for issuer accounts. Must match `state::ISSUER_SEED` in the Anchor program.
pub const ISSUER_SEED: &[u8] = b"issuer";

/// PDA seed for nullifier marker accounts. Must match `state::NULLIFIER_SEED`.
pub const NULLIFIER_SEED: &[u8] = b"nullifier";

/// PDA seed for attestation accounts. Must match `state::ATTESTATION_SEED`.
pub const ATTESTATION_SEED: &[u8] = b"attestation";

/// Index of the Merkle root inside the Groth16 public-input vector.
pub const MERKLE_ROOT_IDX: usize = 0;

/// Index of the nullifier hash inside the Groth16 public-input vector.
pub const NULLIFIER_IDX: usize = 1;
