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
}
