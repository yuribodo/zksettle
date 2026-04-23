use ark_bn254::Fr;
use ark_ff::AdditiveGroup;

use crate::poseidon2_hash;
use crate::error::CryptoError;

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
        Self {
            leaves: Vec::new(),
        }
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

pub fn verify_merkle_proof(
    leaf: Fr,
    proof: &MerkleProof,
    root: Fr,
) -> bool {
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
