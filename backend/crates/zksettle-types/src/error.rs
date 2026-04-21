use thiserror::Error;

#[derive(Debug, Error)]
#[non_exhaustive]
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
    #[error("issuer merkle root is stale; re-publish before verifying")]
    RootStale,
    #[error("nullifier hash must be non-zero")]
    ZeroNullifier,
    #[error("witness mint limbs do not match instruction argument")]
    MintMismatch,
    #[error("witness epoch does not match instruction argument")]
    EpochMismatch,
    #[error("witness recipient limbs do not match instruction argument")]
    RecipientMismatch,
    #[error("witness amount does not match instruction argument")]
    AmountMismatch,
    #[error("proof epoch is in the future relative to on-chain clock")]
    EpochInFuture,
    #[error("proof epoch is older than allowed freshness window")]
    EpochStale,
    #[error("attestation has expired beyond the validity window")]
    AttestationExpired,
    #[error("on-chain clock returned a negative unix timestamp")]
    NegativeClock,
    #[error("light protocol tree pubkey lookup failed")]
    LightTreeLookupFailed,
    #[error("packing a compressed account for light CPI failed")]
    LightAccountPackFailed,
    #[error("light protocol CPI invoke failed")]
    LightInvokeFailed,
    #[error("compressed account address is invalid")]
    InvalidLightAddress,
    #[error("hook payload is malformed or too large")]
    HookPayloadInvalid,
    #[error("transfer amount must be non-zero")]
    InvalidTransferAmount,
    #[error("hook payload issuer does not match issuer account")]
    IssuerMismatch,
    #[error("source token account is not owned by token-2022")]
    NotToken2022,
    #[error("transfer hook invoked outside an active token-2022 transfer")]
    NotInTransfer,
    #[error("source token account owner does not match hook owner")]
    OwnerMismatch,

    // Off-chain only.
    #[error("credential expired")]
    CredentialExpired,
    #[error("jurisdiction not permitted by policy")]
    JurisdictionDenied,
    #[error("serialization failed: {0}")]
    Serialization(String),
}
