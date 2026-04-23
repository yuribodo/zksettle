pub mod accounts;
pub mod credential;
pub mod error;
pub mod events;
pub mod gateway;
pub mod policy;

pub use accounts::{CompressedAttestation, CompressedNullifier, Issuer};
pub use credential::{Credential, CredentialCommitment};
pub use error::ZksettleError;
pub use events::{AttestationChecked, ProofSettled};
pub use gateway::{ApiKeyRecord, Tier, UsageRecord};
pub use policy::Policy;

pub type Pubkey = [u8; 32];
pub type Hash32 = [u8; 32];

// Canonical constants — re-exported by programs/zksettle.
pub const ISSUER_SEED: &[u8] = b"issuer";
pub const NULLIFIER_SEED: &[u8] = b"nullifier";
pub const ATTESTATION_SEED: &[u8] = b"attestation";

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
