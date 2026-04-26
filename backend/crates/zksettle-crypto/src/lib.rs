pub mod error;
pub mod merkle;
mod poseidon2;
pub mod smt;

pub use merkle::{MerkleTree, MerkleProof, verify_merkle_proof, MERKLE_DEPTH};
pub use smt::{SparseMerkleTree, SmtProof, verify_smt_exclusion};

pub fn poseidon2_hash(input: &[ark_bn254::Fr]) -> ark_bn254::Fr {
    poseidon2::sponge::hash(input)
}
