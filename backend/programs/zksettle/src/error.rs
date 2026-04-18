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
}
