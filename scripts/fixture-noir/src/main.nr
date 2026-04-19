// Fixture generator for the zksettle thin-slice circuit.
//
// Same hash & merkle logic as `circuits/src/main.nr`, but with `merkle_root`
// and `nullifier` exposed as the `pub` return tuple instead of as `pub`
// inputs. Callers invoke `nargo execute` and parse the `Circuit output: [..]`
// stdout line to obtain the two field elements that the main circuit's
// Prover.toml should commit to.
//
// This package intentionally duplicates the sponge from the main circuit.
// Sharing via a library would require an extra Nargo.toml member and
// nothing about the thin slice needs that yet.
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

fn main(
    wallet: Field,
    path: [Field; MERKLE_DEPTH],
    path_indices: [u1; MERKLE_DEPTH],
    private_key: Field,
    context_hash: Field,
) -> pub [Field; 2] {
    let leaf = poseidon2_hash([wallet]);

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

    let nullifier = poseidon2_hash([private_key, context_hash]);

    [cur, nullifier]
}
