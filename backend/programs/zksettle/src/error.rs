use anchor_lang::prelude::*;

#[error_code]
pub enum ZkSettleError {
    #[msg("Proof or witness bytes are malformed")]
    MalformedProof,
    #[msg("Proof verification failed")]
    ProofInvalid,
    #[msg("Merkle root must be non-zero")]
    ZeroMerkleRoot,
    #[msg("Signer is not the issuer authority")]
    UnauthorizedIssuer,
    #[msg("Witness merkle_root does not match issuer PDA")]
    MerkleRootMismatch,
    #[msg("Witness nullifier does not match instruction argument")]
    NullifierMismatch,
    #[msg("Witness has fewer public inputs than required")]
    WitnessTooShort,
    #[msg("Issuer merkle root is stale; re-publish before verifying")]
    RootStale,
    #[msg("Nullifier hash must be non-zero")]
    ZeroNullifier,
    #[msg("Witness mint limbs do not match instruction argument")]
    MintMismatch,
    #[msg("Witness epoch does not match instruction argument")]
    EpochMismatch,
    #[msg("Witness recipient limbs do not match instruction argument")]
    RecipientMismatch,
    #[msg("Witness amount does not match instruction argument")]
    AmountMismatch,
    #[msg("Proof epoch is in the future relative to on-chain clock")]
    EpochInFuture,
    #[msg("Proof epoch is older than allowed freshness window")]
    EpochStale,
    #[msg("Attestation has expired beyond the validity window")]
    AttestationExpired,
}
