use anchor_lang::prelude::*;

#[error_code]
pub enum ZkSettleError {
    #[msg("Proof or witness bytes are malformed")]
    MalformedProof,
    #[msg("Proof verification failed")]
    ProofInvalid,
}
