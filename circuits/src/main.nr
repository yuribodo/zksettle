// Compliance circuit: Merkle membership, sanctions exclusion, jurisdiction,
// credential expiry, and bound nullifier derivation (5 checks, 11 public inputs).
//
// Public-input order is load-bearing. It must match the `*_IDX` constants in
// backend/programs/zksettle/src/state/pubinputs.rs. Sunspot only promotes
// `pub` function arguments to gnark public-witness slots (return values are
// kept private), so every bound field is declared `pub` here.
//
// Public-input layout (indices 0-7 unchanged from thin-slice):
//   0: merkle_root          4: epoch             8: sanctions_root
//   1: nullifier            5: recipient_lo      9: jurisdiction_root
//   2: mint_lo              6: recipient_hi     10: timestamp
//   3: mint_hi              7: amount
//
// The nullifier binds the user's private key to the transfer context:
//   nullifier = Poseidon2(private_key, mint_lo, mint_hi, epoch,
//                         recipient_lo, recipient_hi, amount)
//
// Noir 1.0.0-beta.18's stdlib marks `Poseidon2::hash` as `pub(crate)`, so we
// inline a sponge on top of the public `poseidon2_permutation` primitive.
// Keep sponge in sync with scripts/fixture-noir/src/main.nr.

use std::hash::poseidon2_permutation;

global MERKLE_DEPTH: u32 = 20;
global RATE: u32 = 3;
global TWO_POW_64: Field = 18446744073709551616;

struct Sponge {
    cache: [Field; 3],
    state: [Field; 4],
    cache_size: u32,
}

impl Sponge {
    fn new(iv: Field) -> Sponge {
        let mut s = Sponge { cache: [0; 3], state: [0; 4], cache_size: 0 };
        s.state[RATE] = iv;
        s
    }

    fn perform_duplex(&mut self) {
        for i in 0..RATE {
            if i < self.cache_size {
                self.state[i] += self.cache[i];
            }
        }
        self.state = poseidon2_permutation(self.state, 4);
    }

    fn absorb(&mut self, input: Field) {
        if self.cache_size == RATE {
            self.perform_duplex();
            self.cache[0] = input;
            self.cache_size = 1;
        } else {
            self.cache[self.cache_size] = input;
            self.cache_size += 1;
        }
    }

    fn squeeze(&mut self) -> Field {
        self.perform_duplex();
        self.state[0]
    }
}

pub fn poseidon2_hash<let N: u32>(input: [Field; N]) -> Field {
    let iv: Field = (N as Field) * TWO_POW_64;
    let mut sponge = Sponge::new(iv);
    for i in 0..N {
        sponge.absorb(input[i]);
    }
    sponge.squeeze()
}

fn verify_merkle_path(
    leaf: Field,
    path: [Field; MERKLE_DEPTH],
    path_indices: [u1; MERKLE_DEPTH],
    root: Field,
) {
    let mut cur = leaf;
    for i in 0..MERKLE_DEPTH {
        let sibling = path[i];
        let (l, r) = if path_indices[i] == 0 {
            (cur, sibling)
        } else {
            (sibling, cur)
        };
        cur = poseidon2_hash([l, r]);
    }
    assert(cur == root);
}

fn main(
    // --- public inputs (indices 0-10) ---
    merkle_root: pub Field,
    nullifier: pub Field,
    mint_lo: pub Field,
    mint_hi: pub Field,
    epoch: pub Field,
    recipient_lo: pub Field,
    recipient_hi: pub Field,
    amount: pub Field,
    sanctions_root: pub Field,
    jurisdiction_root: pub Field,
    timestamp: pub Field,
    // --- private inputs ---
    wallet: Field,
    path: [Field; MERKLE_DEPTH],
    path_indices: [u1; MERKLE_DEPTH],
    private_key: Field,
    sanctions_path: [Field; MERKLE_DEPTH],
    sanctions_path_indices: [u1; MERKLE_DEPTH],
    sanctions_leaf_value: Field,
    jurisdiction: Field,
    jurisdiction_path: [Field; MERKLE_DEPTH],
    jurisdiction_path_indices: [u1; MERKLE_DEPTH],
    credential_expiry: Field,
) {
    // Check 1: membership - wallet leaf exists in allowlist Merkle tree
    let leaf = poseidon2_hash([wallet]);
    verify_merkle_path(leaf, path, path_indices, merkle_root);

    // Check 2: nullifier - binds private_key to transfer context
    let derived = poseidon2_hash([
        private_key,
        mint_lo,
        mint_hi,
        epoch,
        recipient_lo,
        recipient_hi,
        amount,
    ]);
    assert(derived == nullifier);

    // Check 3: sanctions exclusion - path indices derived from wallet,
    // preventing prover from opening arbitrary zero-leaves in sparse tree.
    let key_bits: [u1; 254] = leaf.to_le_bits();
    for i in 0..MERKLE_DEPTH {
        assert(sanctions_path_indices[i] == key_bits[i]);
    }
    assert(sanctions_leaf_value == 0);
    verify_merkle_path(
        sanctions_leaf_value,
        sanctions_path,
        sanctions_path_indices,
        sanctions_root,
    );

    // Check 4: jurisdiction - jurisdiction leaf exists in allowed-jurisdictions tree
    let jurisdiction_leaf = poseidon2_hash([jurisdiction]);
    verify_merkle_path(
        jurisdiction_leaf,
        jurisdiction_path,
        jurisdiction_path_indices,
        jurisdiction_root,
    );

    // Check 5: credential valid through expiry (inclusive)
    assert((timestamp as u64) <= (credential_expiry as u64));
}
