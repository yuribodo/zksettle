pub mod bubblegum_mint;
pub mod check_attestation;
pub mod init_attestation_tree;
pub mod register_issuer;
mod settle_core;
pub mod transfer_hook;
pub mod verify_proof;

// Glob re-export so `Context<...>` in `lib.rs`'s `#[program]` module resolves
// against `super::*` and the Anchor-generated `__client_accounts_*` sibling
// modules are visible to the macro. Handler functions are named uniquely per
// instruction to avoid glob conflicts.
pub use bubblegum_mint::*;
pub use check_attestation::*;
pub use init_attestation_tree::*;
pub use register_issuer::*;
pub use transfer_hook::*;
pub use verify_proof::*;
