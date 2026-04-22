pub const ISSUER_SEED: &[u8] = b"issuer";
pub const NULLIFIER_SEED: &[u8] = b"nullifier";
pub const ATTESTATION_SEED: &[u8] = b"attestation";
/// Global registry PDA for the Bubblegum attestation merkle tree (ADR-019).
pub const BUBBLEGUM_REGISTRY_SEED: &[u8] = b"bubblegum-registry";
/// PDA that signs as `tree_creator` / `tree_creator_or_delegate` for Bubblegum CPIs.
pub const BUBBLEGUM_TREE_CREATOR_SEED: &[u8] = b"bubblegum-tree-creator";
