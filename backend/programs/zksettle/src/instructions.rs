pub mod verify_proof;

// Glob re-export so `Context<VerifyProof>` in `lib.rs`'s `#[program]` module
// resolves against `super::*`; swap to an explicit list only after auditing
// which Anchor-generated items the macro still needs in scope.
pub use verify_proof::*;
