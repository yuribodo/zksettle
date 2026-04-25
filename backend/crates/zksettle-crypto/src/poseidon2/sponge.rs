use ark_bn254::Fr;
use ark_ff::{AdditiveGroup, MontFp};

use super::permutation;

const RATE: usize = 3;
const TWO_POW_64: Fr = MontFp!("18446744073709551616");

pub struct Sponge {
    cache: [Fr; RATE],
    state: [Fr; 4],
    cache_size: usize,
}

impl Sponge {
    fn new(iv: Fr) -> Self {
        let mut s = Self {
            cache: [Fr::ZERO; RATE],
            state: [Fr::ZERO; 4],
            cache_size: 0,
        };
        s.state[RATE] = iv;
        s
    }

    fn perform_duplex(&mut self) {
        for i in 0..RATE {
            if i < self.cache_size {
                self.state[i] += self.cache[i];
            }
        }
        permutation(&mut self.state);
    }

    fn absorb(&mut self, input: Fr) {
        if self.cache_size == RATE {
            self.perform_duplex();
            self.cache[0] = input;
            self.cache_size = 1;
        } else {
            self.cache[self.cache_size] = input;
            self.cache_size += 1;
        }
    }

    fn squeeze(&mut self) -> Fr {
        self.perform_duplex();
        self.state[0]
    }
}

pub fn hash(input: &[Fr]) -> Fr {
    let iv = Fr::from(input.len() as u64) * TWO_POW_64;
    let mut sponge = Sponge::new(iv);
    for &elem in input {
        sponge.absorb(elem);
    }
    sponge.squeeze()
}
