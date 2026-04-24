use ark_bn254::Fr;
use ark_ff::AdditiveGroup;

use crate::error::CryptoError;
use crate::poseidon2_hash;

pub const MERKLE_DEPTH: usize = 20;

pub struct MerkleTree {
    leaves: Vec<Fr>,
}

pub struct MerkleProof {
    pub path: [Fr; MERKLE_DEPTH],
    pub path_indices: [u8; MERKLE_DEPTH],
}

impl MerkleTree {
    pub fn new() -> Self {
        Self { leaves: Vec::new() }
    }

    pub fn insert(&mut self, leaf: Fr) {
        self.leaves.push(leaf);
    }

    pub fn set_leaf(&mut self, index: usize, value: Fr) -> Result<(), CryptoError> {
        if index >= self.leaves.len() {
            return Err(CryptoError::IndexOutOfBounds {
                index,
                size: self.leaves.len(),
            });
        }
        self.leaves[index] = value;
        Ok(())
    }

    pub fn zero_leaf(&mut self, index: usize) -> Result<(), CryptoError> {
        self.set_leaf(index, Fr::ZERO)
    }

    pub fn root(&self) -> Fr {
        self.compute_root_from_leaves()
    }

    fn compute_root_from_leaves(&self) -> Fr {
        if self.leaves.is_empty() {
            let mut cur = Fr::ZERO;
            for _ in 0..MERKLE_DEPTH {
                cur = poseidon2_hash(&[cur, cur]);
            }
            return cur;
        }

        let mut level: Vec<Fr> = self.leaves.clone();

        for _ in 0..MERKLE_DEPTH {
            let len = level.len();
            let mut next = Vec::with_capacity(len.div_ceil(2));
            let mut i = 0;
            while i < len {
                let left = level[i];
                let right = if i + 1 < len { level[i + 1] } else { Fr::ZERO };
                next.push(poseidon2_hash(&[left, right]));
                i += 2;
            }
            level = next;
        }

        level[0]
    }

    pub fn proof(&self, index: usize) -> Result<MerkleProof, CryptoError> {
        if index >= self.leaves.len() {
            return Err(CryptoError::IndexOutOfBounds {
                index,
                size: self.leaves.len(),
            });
        }

        let mut path = [Fr::ZERO; MERKLE_DEPTH];
        let mut path_indices = [0u8; MERKLE_DEPTH];
        let mut level: Vec<Fr> = self.leaves.clone();

        for d in 0..MERKLE_DEPTH {
            let idx_at_level = index >> d;
            let sibling_idx = idx_at_level ^ 1;

            path[d] = if sibling_idx < level.len() {
                level[sibling_idx]
            } else {
                Fr::ZERO
            };
            path_indices[d] = (idx_at_level & 1) as u8;

            let len = level.len();
            let mut next = Vec::with_capacity(len.div_ceil(2));
            let mut i = 0;
            while i < len {
                let left = level[i];
                let right = if i + 1 < len { level[i + 1] } else { Fr::ZERO };
                next.push(poseidon2_hash(&[left, right]));
                i += 2;
            }
            level = next;
        }

        Ok(MerkleProof { path, path_indices })
    }
}

pub fn verify_merkle_proof(leaf: Fr, proof: &MerkleProof, root: Fr) -> bool {
    let mut cur = leaf;
    for i in 0..MERKLE_DEPTH {
        let (l, r) = if proof.path_indices[i] == 0 {
            (cur, proof.path[i])
        } else {
            (proof.path[i], cur)
        };
        cur = poseidon2_hash(&[l, r]);
    }
    cur == root
}

impl Default for MerkleTree {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_tree_root_is_deterministic() {
        // depth-20 zero chain must be stable across independent instances
        assert_eq!(MerkleTree::new().root(), MerkleTree::new().root());
    }

    #[test]
    fn default_root_matches_new_root() {
        assert_eq!(MerkleTree::default().root(), MerkleTree::new().root());
    }

    #[test]
    fn last_index_proof_verifies_with_odd_leaf_count() {
        // odd leaf count exercises the sibling-padding branch in proof()
        let mut tree = MerkleTree::new();
        for i in 1..=3u64 {
            tree.insert(poseidon2_hash(&[Fr::from(i)]));
        }
        let last_leaf = poseidon2_hash(&[Fr::from(3u64)]);
        let proof = tree.proof(2).expect("proof at last index");
        assert!(verify_merkle_proof(last_leaf, &proof, tree.root()));
    }

    #[test]
    fn proof_rejects_out_of_bounds_index() {
        let mut tree = MerkleTree::new();
        tree.insert(Fr::from(1u64));
        assert!(matches!(
            tree.proof(1),
            Err(CryptoError::IndexOutOfBounds { index: 1, size: 1 })
        ));
    }

    #[test]
    fn set_leaf_rejects_out_of_bounds_index() {
        let mut tree = MerkleTree::new();
        tree.insert(Fr::from(1u64));
        assert!(matches!(
            tree.set_leaf(5, Fr::ZERO),
            Err(CryptoError::IndexOutOfBounds { index: 5, size: 1 })
        ));
    }

    #[test]
    fn verify_rejects_tampered_leaf() {
        let leaf = poseidon2_hash(&[Fr::from(1u64)]);
        let mut tree = MerkleTree::new();
        tree.insert(leaf);
        let proof = tree.proof(0).expect("proof");
        let tampered = poseidon2_hash(&[Fr::from(99u64)]);
        assert!(!verify_merkle_proof(tampered, &proof, tree.root()));
    }

    #[test]
    fn zero_leaf_is_idempotent() {
        let mut tree = MerkleTree::new();
        tree.insert(poseidon2_hash(&[Fr::from(1u64)]));
        tree.zero_leaf(0).expect("first zero");
        let root_once = tree.root();
        tree.zero_leaf(0).expect("second zero");
        assert_eq!(tree.root(), root_once);
    }
}
