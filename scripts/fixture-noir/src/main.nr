// Fixture generator for the zksettle compliance circuit.
//
// Same hash & merkle logic as `circuits/src/main.nr`, but with computed roots
// and nullifier exposed as the `pub` return tuple instead of as `pub` inputs.
// Callers invoke `nargo execute` and parse the `Circuit output: [..]` stdout
// line to obtain the field elements that the main circuit's Prover.toml should
// commit to.
//
// Returns [merkle_root, nullifier, sanctions_root, jurisdiction_root].
//
// This package intentionally duplicates the sponge from the main circuit.
// Keep sponge logic below in sync with circuits/src/main.nr.

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

fn poseidon2_hash<let N: u32>(input: [Field; N]) -> Field {
    let iv: Field = (N as Field) * TWO_POW_64;
    let mut sponge = Sponge::new(iv);
    for i in 0..N {
        sponge.absorb(input[i]);
    }
    sponge.squeeze()
}

fn compute_merkle_root(
    leaf: Field,
    path: [Field; MERKLE_DEPTH],
    path_indices: [u1; MERKLE_DEPTH],
) -> Field {
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
    cur
}

fn main(
    wallet: Field,
    path: [Field; MERKLE_DEPTH],
    path_indices: [u1; MERKLE_DEPTH],
    private_key: Field,
    mint_lo: Field,
    mint_hi: Field,
    epoch: Field,
    recipient_lo: Field,
    recipient_hi: Field,
    amount: Field,
    sanctions_path: [Field; MERKLE_DEPTH],
    sanctions_leaf_value: Field,
    jurisdiction: Field,
    jurisdiction_path: [Field; MERKLE_DEPTH],
    jurisdiction_path_indices: [u1; MERKLE_DEPTH],
) -> pub [Field; 4] {
    let membership_leaf = poseidon2_hash([wallet]);
    let merkle_root = compute_merkle_root(membership_leaf, path, path_indices);

    let nullifier = poseidon2_hash([
        private_key,
        mint_lo,
        mint_hi,
        epoch,
        recipient_lo,
        recipient_hi,
        amount,
    ]);

    let key_bits: [u1; 254] = membership_leaf.to_le_bits();
    let mut sanctions_path_indices: [u1; MERKLE_DEPTH] = [0; MERKLE_DEPTH];
    for i in 0..MERKLE_DEPTH {
        sanctions_path_indices[i] = key_bits[i];
    }
    let sanctions_root = compute_merkle_root(
        sanctions_leaf_value,
        sanctions_path,
        sanctions_path_indices,
    );

    let jurisdiction_leaf = poseidon2_hash([jurisdiction]);
    let jurisdiction_root = compute_merkle_root(
        jurisdiction_leaf,
        jurisdiction_path,
        jurisdiction_path_indices,
    );

    [merkle_root, nullifier, sanctions_root, jurisdiction_root]
}
