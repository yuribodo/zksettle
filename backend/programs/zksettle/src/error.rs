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
    #[msg("On-chain clock returned a negative unix timestamp")]
    NegativeClock,
    #[msg("Light Protocol tree pubkey lookup failed")]
    LightTreeLookupFailed,
    #[msg("Packing a compressed account for Light CPI failed")]
    LightAccountPackFailed,
    #[msg("Light Protocol CPI invoke failed")]
    LightInvokeFailed,
    #[msg("Compressed account address is invalid")]
    InvalidLightAddress,
    #[msg("Hook payload is malformed or too large")]
    HookPayloadInvalid,
    #[msg("Transfer amount must be non-zero")]
    InvalidTransferAmount,
    #[msg("Hook payload issuer does not match issuer account")]
    IssuerMismatch,
    #[msg("Source token account is not owned by Token-2022")]
    NotToken2022,
    #[msg("Transfer hook invoked outside an active Token-2022 transfer")]
    NotInTransfer,
    #[msg("Source token account owner does not match hook owner")]
    OwnerMismatch,
}

/// Map an external Result's Err into a `ZkSettleError`, logging the source via
/// `msg!` first. Designed for use inside `.map_err(...)` chains around Light
/// SDK / gnark calls.
#[macro_export]
macro_rules! map_light_err {
    ($ctx:literal, $variant:expr) => {
        |e| {
            msg!(concat!($ctx, ": {:?}"), e);
            error!($variant)
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::error::ERROR_CODE_OFFSET;

    #[test]
    fn map_light_err_produces_correct_variant() {
        let mapper = map_light_err!("test context", ZkSettleError::MalformedProof);
        let result: std::result::Result<(), anchor_lang::error::Error> =
            Err(mapper("some upstream error"));
        match result {
            Err(anchor_lang::error::Error::AnchorError(e)) => {
                assert_eq!(
                    e.error_code_number,
                    ERROR_CODE_OFFSET + ZkSettleError::MalformedProof as u32
                );
            }
            other => panic!("expected AnchorError, got {other:?}"),
        }
    }

    #[test]
    fn error_variants_have_unique_codes() {
        let codes = [
            ZkSettleError::MalformedProof as u32,
            ZkSettleError::ProofInvalid as u32,
            ZkSettleError::ZeroMerkleRoot as u32,
            ZkSettleError::UnauthorizedIssuer as u32,
            ZkSettleError::MerkleRootMismatch as u32,
            ZkSettleError::NullifierMismatch as u32,
            ZkSettleError::WitnessTooShort as u32,
            ZkSettleError::RootStale as u32,
            ZkSettleError::ZeroNullifier as u32,
            ZkSettleError::MintMismatch as u32,
            ZkSettleError::EpochMismatch as u32,
            ZkSettleError::RecipientMismatch as u32,
            ZkSettleError::AmountMismatch as u32,
            ZkSettleError::EpochInFuture as u32,
            ZkSettleError::EpochStale as u32,
            ZkSettleError::AttestationExpired as u32,
            ZkSettleError::NegativeClock as u32,
            ZkSettleError::HookPayloadInvalid as u32,
            ZkSettleError::InvalidTransferAmount as u32,
            ZkSettleError::IssuerMismatch as u32,
            ZkSettleError::NotToken2022 as u32,
            ZkSettleError::NotInTransfer as u32,
            ZkSettleError::OwnerMismatch as u32,
        ];
        let mut seen = std::collections::HashSet::new();
        for code in &codes {
            assert!(seen.insert(code), "duplicate error code: {code}");
        }
    }
}
