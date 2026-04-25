use ark_bn254::Fr;
use ark_ff::{AdditiveGroup, BigInteger, PrimeField};

use crate::error::CryptoError;
use crate::merkle::MERKLE_DEPTH;
use crate::poseidon2_hash;

fn key_bits(key: Fr) -> [bool; MERKLE_DEPTH] {
    let repr = key.into_bigint();
    let le_bytes = repr.to_bytes_le();
    let mut bits = [false; MERKLE_DEPTH];
    for i in 0..MERKLE_DEPTH {
        bits[i] = (le_bytes[i / 8] >> (i % 8)) & 1 == 1;
    }
    bits
}

fn empty_subtree_hashes() -> [Fr; MERKLE_DEPTH + 1] {
    let mut h = [Fr::ZERO; MERKLE_DEPTH + 1];
    for i in 1..=MERKLE_DEPTH {
        h[i] = poseidon2_hash(&[h[i - 1], h[i - 1]]);
    }
    h
}

pub struct SparseMerkleTree {
    leaves: std::collections::HashMap<[bool; MERKLE_DEPTH], Fr>,
    empty_hashes: [Fr; MERKLE_DEPTH + 1],
}

#[derive(Debug)]
pub struct SmtProof {
    pub path: [Fr; MERKLE_DEPTH],
    pub path_indices: [u8; MERKLE_DEPTH],
    pub leaf_value: Fr,
}

impl SparseMerkleTree {
    pub fn new() -> Self {
        Self {
            leaves: std::collections::HashMap::new(),
            empty_hashes: empty_subtree_hashes(),
        }
    }

    pub fn insert(&mut self, wallet: Fr) {
        let leaf_hash = poseidon2_hash(&[wallet]);
        let bits = key_bits(leaf_hash);
        self.leaves.insert(bits, Fr::from(1u64));
    }

    pub fn remove(&mut self, wallet: Fr) -> bool {
        let leaf_hash = poseidon2_hash(&[wallet]);
        let bits = key_bits(leaf_hash);
        self.leaves.remove(&bits).is_some()
    }

    pub fn root(&self) -> Fr {
        self.subtree_hash_at_level(MERKLE_DEPTH, &[])
    }

    // prefix bits are top-down (prefix[0] = choice at level MERKLE_DEPTH-1).
    fn subtree_hash_at_level(&self, level: usize, prefix: &[bool]) -> Fr {
        if level == 0 {
            let mut bits = [false; MERKLE_DEPTH];
            // prefix is top-down, bits are bottom-up (LE); reverse
            for (i, &b) in prefix.iter().enumerate() {
                bits[MERKLE_DEPTH - 1 - i] = b;
            }
            return self.leaves.get(&bits).copied().unwrap_or(Fr::ZERO);
        }

        if !self.has_leaves_under(prefix) {
            return self.empty_hashes[level];
        }

        let mut left_prefix = prefix.to_vec();
        left_prefix.push(false);
        let mut right_prefix = prefix.to_vec();
        right_prefix.push(true);

        let left = self.subtree_hash_at_level(level - 1, &left_prefix);
        let right = self.subtree_hash_at_level(level - 1, &right_prefix);

        poseidon2_hash(&[left, right])
    }

    fn has_leaves_under(&self, prefix: &[bool]) -> bool {
        self.leaves.keys().any(|bits| {
            prefix.iter().enumerate().all(|(i, &b)| {
                bits[MERKLE_DEPTH - 1 - i] == b
            })
        })
    }

    pub fn exclusion_proof(&self, wallet: Fr) -> Result<SmtProof, CryptoError> {
        let leaf_hash = poseidon2_hash(&[wallet]);
        let bits = key_bits(leaf_hash);

        if self.leaves.contains_key(&bits) {
            return Err(CryptoError::WalletIsSanctioned);
        }

        let path = self.sibling_path(&bits);
        let mut path_indices = [0u8; MERKLE_DEPTH];
        for i in 0..MERKLE_DEPTH {
            path_indices[i] = bits[i] as u8;
        }

        Ok(SmtProof {
            path,
            path_indices,
            leaf_value: Fr::ZERO,
        })
    }

    // Empty sibling at level i = empty_hashes[i].
    fn sibling_path(&self, bits: &[bool; MERKLE_DEPTH]) -> [Fr; MERKLE_DEPTH] {
        let mut path = [Fr::ZERO; MERKLE_DEPTH];

        for i in 0..MERKLE_DEPTH {
            let mut prefix = Vec::new();
            // Top-down path from root to the parent of level i:
            for j in (i + 1..MERKLE_DEPTH).rev() {
                prefix.push(bits[j]);
            }
            // Sibling direction
            prefix.push(!bits[i]);

            path[i] = self.subtree_hash_at_level(i, &prefix);
        }

        path
    }
}

pub fn verify_smt_exclusion(
    wallet: Fr,
    proof: &SmtProof,
    root: Fr,
) -> Result<(), CryptoError> {
    if proof.leaf_value != Fr::ZERO {
        return Err(CryptoError::WalletIsSanctioned);
    }

    let leaf_hash = poseidon2_hash(&[wallet]);
    let expected_bits = key_bits(leaf_hash);
    for (idx, &expected) in proof.path_indices.iter().zip(expected_bits.iter()) {
        if *idx != expected as u8 {
            return Err(CryptoError::InvalidSmtPathIndices);
        }
    }

    let mut cur = proof.leaf_value;
    for i in 0..MERKLE_DEPTH {
        let (l, r) = if proof.path_indices[i] == 0 {
            (cur, proof.path[i])
        } else {
            (proof.path[i], cur)
        };
        cur = poseidon2_hash(&[l, r]);
    }

    if cur != root {
        return Err(CryptoError::RootMismatch);
    }

    Ok(())
}

impl Default for SparseMerkleTree {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ark_ff::AdditiveGroup;

    fn wallet(n: u64) -> Fr {
        Fr::from(n)
    }

    #[test]
    fn key_bits_known_input() {
        let bits = key_bits(Fr::from(1u64));
        assert!(bits[0], "bit 0 of 1 must be set");
        assert!(!bits[1], "bit 1 of 1 must be unset");
        assert!(!bits[19], "bit 19 of 1 must be unset");

        let bits5 = key_bits(Fr::from(5u64)); // 101 in binary
        assert!(bits5[0]);
        assert!(!bits5[1]);
        assert!(bits5[2]);
    }

    #[test]
    fn empty_tree_root_is_deterministic() {
        let smt = SparseMerkleTree::new();
        let root1 = smt.root();
        let root2 = SparseMerkleTree::new().root();
        assert_eq!(root1, root2);
    }

    #[test]
    fn insert_changes_root() {
        let mut smt = SparseMerkleTree::new();
        let empty_root = smt.root();
        smt.insert(wallet(42));
        assert_ne!(smt.root(), empty_root);
    }

    #[test]
    fn remove_present_returns_true() {
        let mut smt = SparseMerkleTree::new();
        smt.insert(wallet(1));
        assert!(smt.remove(wallet(1)));
    }

    #[test]
    fn remove_absent_returns_false() {
        let mut smt = SparseMerkleTree::new();
        assert!(!smt.remove(wallet(999)));
    }

    #[test]
    fn remove_restores_root() {
        let mut smt = SparseMerkleTree::new();
        let empty_root = smt.root();
        smt.insert(wallet(7));
        smt.remove(wallet(7));
        assert_eq!(smt.root(), empty_root);
    }

    #[test]
    fn subtree_hash_nonempty_differs_from_empty() {
        let mut smt = SparseMerkleTree::new();
        smt.insert(wallet(1));
        let root = smt.root();
        assert_ne!(root, smt.empty_hashes[MERKLE_DEPTH]);
    }

    #[test]
    fn has_leaves_under_positive_and_negative() {
        let mut smt = SparseMerkleTree::new();
        smt.insert(wallet(1));
        let leaf_hash = poseidon2_hash(&[wallet(1)]);
        let bits = key_bits(leaf_hash);
        let top_bit = bits[MERKLE_DEPTH - 1];
        assert!(smt.has_leaves_under(&[top_bit]));
        assert!(!smt.has_leaves_under(&[!top_bit]));
    }

    #[test]
    fn sibling_path_nonempty() {
        let mut smt = SparseMerkleTree::new();
        smt.insert(wallet(10));
        smt.insert(wallet(20));

        let leaf_hash = poseidon2_hash(&[wallet(10)]);
        let bits = key_bits(leaf_hash);
        let path = smt.sibling_path(&bits);
        let has_nonzero = path.iter().any(|&h| h != Fr::ZERO);
        assert!(has_nonzero, "sibling path should have non-zero elements when tree is populated");
    }

    #[test]
    fn exclusion_proof_verifies() {
        let mut smt = SparseMerkleTree::new();
        smt.insert(wallet(100));
        smt.insert(wallet(200));
        let root = smt.root();

        let proof = smt.exclusion_proof(wallet(50)).unwrap();
        verify_smt_exclusion(wallet(50), &proof, root).unwrap();
    }

    #[test]
    fn exclusion_proof_for_sanctioned_wallet_errors() {
        let mut smt = SparseMerkleTree::new();
        smt.insert(wallet(100));
        let err = smt.exclusion_proof(wallet(100)).unwrap_err();
        assert!(matches!(err, CryptoError::WalletIsSanctioned));
    }

    #[test]
    fn verify_rejects_wrong_root() {
        let mut smt = SparseMerkleTree::new();
        smt.insert(wallet(100));
        let root = smt.root();
        let proof = smt.exclusion_proof(wallet(50)).unwrap();
        let wrong_root = poseidon2_hash(&[root]);
        let err = verify_smt_exclusion(wallet(50), &proof, wrong_root).unwrap_err();
        assert!(matches!(err, CryptoError::RootMismatch));
    }

    #[test]
    fn verify_rejects_nonzero_leaf() {
        let mut smt = SparseMerkleTree::new();
        smt.insert(wallet(100));
        let root = smt.root();
        let mut proof = smt.exclusion_proof(wallet(50)).unwrap();
        proof.leaf_value = Fr::from(1u64);
        let err = verify_smt_exclusion(wallet(50), &proof, root).unwrap_err();
        assert!(matches!(err, CryptoError::WalletIsSanctioned));
    }

    #[test]
    fn verify_rejects_wrong_path_indices() {
        let mut smt = SparseMerkleTree::new();
        smt.insert(wallet(100));
        let root = smt.root();
        let mut proof = smt.exclusion_proof(wallet(50)).unwrap();
        proof.path_indices[0] ^= 1;
        let err = verify_smt_exclusion(wallet(50), &proof, root).unwrap_err();
        assert!(matches!(err, CryptoError::InvalidSmtPathIndices));
    }

    #[test]
    fn default_trait() {
        let smt = SparseMerkleTree::default();
        assert_eq!(smt.root(), SparseMerkleTree::new().root());
    }
}
