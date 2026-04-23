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
            // Top-down prefix: wallet path to branch point, last bit flipped for sibling.
            let depth_from_top = MERKLE_DEPTH - 1 - i;
            let mut prefix = Vec::with_capacity(depth_from_top + 1);
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
