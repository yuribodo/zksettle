//! Shared types for ZKSettle on-chain / off-chain interop.

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
