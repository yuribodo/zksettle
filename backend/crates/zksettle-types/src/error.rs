//! Shared error enum for ZKSettle off-chain components.
//!
//! On-chain variants mirror `ZkSettleError` in
//! `backend/programs/zksettle/src/error.rs` so services that surface an RPC
//! error back to the caller can translate program error codes into a typed
//! variant. Off-chain-only variants cover failures that never reach the
//! program (HTTP, serialization, policy pre-checks).

use thiserror::Error;

/// Errors that can surface when handling ZKSettle credentials, proofs, or
/// attestations outside the on-chain program.
#[derive(Debug, Error)]
pub enum ZksettleError {
    // --- Mirrors of on-chain error codes -----------------------------------
    #[error("proof or witness bytes are malformed")]
    MalformedProof,

    #[error("proof verification failed")]
    ProofInvalid,

    #[error("merkle root must be non-zero")]
    ZeroMerkleRoot,

    #[error("signer is not the issuer authority")]
    UnauthorizedIssuer,

    #[error("witness merkle_root does not match issuer PDA")]
    MerkleRootMismatch,

    #[error("witness nullifier does not match instruction argument")]
    NullifierMismatch,

    #[error("witness has fewer public inputs than required")]
    WitnessTooShort,

    // --- Off-chain-only variants -------------------------------------------
    #[error("credential expired")]
    CredentialExpired,

    #[error("jurisdiction not permitted by policy")]
    JurisdictionDenied,

    #[error("serialization failed: {0}")]
    Serialization(String),
}
