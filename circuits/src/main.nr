// Compliance thin-slice circuit: Merkle membership + bound nullifier derivation.
//
// Public-input order is load-bearing. It must match the `*_IDX` constants in
// backend/programs/zksettle/src/state/pubinputs.rs. Sunspot only promotes
// `pub` function arguments to gnark public-witness slots (return values are
// kept private), so every bound field is declared `pub` here.
//
// The nullifier binds the user's private key to the transfer context:
//   nullifier = Poseidon2(private_key, mint_lo, mint_hi, epoch,
//                         recipient_lo, recipient_hi, amount)
// This closes ADR-020 (security-critical): a proof is useless outside the exact
// (mint, epoch, recipient, amount) tuple it was minted for. Pubkey fields
// are split into two 128-bit limbs so they fit safely inside BN254's
// ~254-bit scalar field (hi = top 16 BE bytes, lo = bottom 16 BE bytes).
//
// Canonical pub-input values are derived off-circuit by the fixture nargo
// package in `scripts/fixture-noir/`. Its `nargo execute` prints the
// expected (merkle_root, nullifier) pair for a given Prover.toml so tests
// can fill the main Prover.toml and register_issuer with matching bytes.
// Keep sponge in sync with scripts/fixture-noir/src/main.nr.
//
// Noir 1.0.0-beta.18's stdlib marks `Poseidon2::hash` as `pub(crate)`, so we
// inline a sponge on top of the public `poseidon2_permutation` primitive.

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
    // Fixed-length sponge: in_len == N, no variable-length sentinel.
    let iv: Field = (N as Field) * TWO_POW_64;
    let mut sponge = Sponge::new(iv);
    for i in 0..N {
        sponge.absorb(input[i]);
    }
    sponge.squeeze()
}

fn main(
    merkle_root: pub Field,
    nullifier: pub Field,
    mint_lo: pub Field,
    mint_hi: pub Field,
    epoch: pub Field,
    recipient_lo: pub Field,
    recipient_hi: pub Field,
    amount: pub Field,
    wallet: Field,
    path: [Field; MERKLE_DEPTH],
    path_indices: [u1; MERKLE_DEPTH],
    private_key: Field,
) {
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
    assert(cur == merkle_root);

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
}
