pub mod register_issuer;
pub mod verify_proof;

// Glob re-export so `Context<...>` in `lib.rs`'s `#[program]` module resolves
// against `super::*` and the Anchor-generated `__client_accounts_*` sibling
// modules are visible to the macro. Handler functions are named uniquely per
// instruction to avoid glob conflicts.
pub use register_issuer::*;
pub use verify_proof::*;
