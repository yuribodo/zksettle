pub mod accounts;
pub mod credential;
pub mod error;
pub mod events;
pub mod policy;

pub use accounts::{CompressedAttestation, CompressedNullifier, Issuer};
pub use credential::{Credential, CredentialCommitment};
pub use error::ZksettleError;
pub use events::{AttestationChecked, ProofSettled};
pub use policy::Policy;

pub type Pubkey = [u8; 32];
pub type Hash32 = [u8; 32];

// Must match `programs/zksettle/src/state/seeds.rs`.
pub const ISSUER_SEED: &[u8] = b"issuer";
pub const NULLIFIER_SEED: &[u8] = b"nullifier";
pub const ATTESTATION_SEED: &[u8] = b"attestation";

// Must match `programs/zksettle/src/state/pubinputs.rs`.
pub const MERKLE_ROOT_IDX: usize = 0;
pub const NULLIFIER_IDX: usize = 1;
pub const MINT_LO_IDX: usize = 2;
pub const MINT_HI_IDX: usize = 3;
pub const EPOCH_IDX: usize = 4;
pub const RECIPIENT_LO_IDX: usize = 5;
pub const RECIPIENT_HI_IDX: usize = 6;
pub const AMOUNT_IDX: usize = 7;
pub const SANCTIONS_ROOT_IDX: usize = 8;
pub const JURISDICTION_ROOT_IDX: usize = 9;
pub const TIMESTAMP_IDX: usize = 10;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_constants_match_on_chain() {
        assert_eq!(ISSUER_SEED, b"issuer");
        assert_eq!(NULLIFIER_SEED, b"nullifier");
        assert_eq!(ATTESTATION_SEED, b"attestation");
    }

    #[test]
    fn pubinput_indices_match_on_chain() {
        assert_eq!(MERKLE_ROOT_IDX, 0);
        assert_eq!(NULLIFIER_IDX, 1);
        assert_eq!(MINT_LO_IDX, 2);
        assert_eq!(MINT_HI_IDX, 3);
        assert_eq!(EPOCH_IDX, 4);
        assert_eq!(RECIPIENT_LO_IDX, 5);
        assert_eq!(RECIPIENT_HI_IDX, 6);
        assert_eq!(AMOUNT_IDX, 7);
        assert_eq!(SANCTIONS_ROOT_IDX, 8);
        assert_eq!(JURISDICTION_ROOT_IDX, 9);
        assert_eq!(TIMESTAMP_IDX, 10);
    }
}
