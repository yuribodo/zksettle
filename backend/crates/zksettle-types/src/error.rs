use thiserror::Error;

#[derive(Debug, Error)]
pub enum ZksettleError {
    // Mirrors of on-chain `ZkSettleError` variants.
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

    // Off-chain only.
    #[error("credential expired")]
    CredentialExpired,
    #[error("jurisdiction not permitted by policy")]
    JurisdictionDenied,
    #[error("serialization failed: {0}")]
    Serialization(String),
}
