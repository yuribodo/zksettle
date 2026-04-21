mod params;
pub(crate) mod sponge;

use ark_bn254::Fr;
use ark_ff::{AdditiveGroup, Field};

use params::{INTERNAL_DIAG, RC, T};

fn sbox(x: Fr) -> Fr {
    let x2 = x.square();
    let x4 = x2.square();
    x4 * x
}

fn mat_full_4(state: &mut [Fr; T]) {
    let t0 = state[0] + state[1];
    let t1 = state[2] + state[3];
    let t2 = state[1].double() + t1;
    let t3 = state[3].double() + t0;
    let t4 = t1.double().double() + t3;
    let t5 = t0.double().double() + t2;
    let t6 = t3 + t5;
    let t7 = t2 + t4;
    state[0] = t6;
    state[1] = t5;
    state[2] = t7;
    state[3] = t4;
}

fn internal_mat_mul(state: &mut [Fr; T]) {
    let sum: Fr = state.iter().sum();
    for (s, d) in state.iter_mut().zip(INTERNAL_DIAG.iter()) {
        *s = *s * d + sum;
    }
}

pub fn permutation(state: &mut [Fr; T]) {
    mat_full_4(state);

    for rc in &RC[..4] {
        for (s, c) in state.iter_mut().zip(rc.iter()) {
            *s += c;
        }
        for s in state.iter_mut() {
            *s = sbox(*s);
        }
        mat_full_4(state);
    }

    for rc in &RC[4..60] {
        state[0] += rc[0];
        state[0] = sbox(state[0]);
        internal_mat_mul(state);
    }

    for rc in &RC[60..64] {
        for (s, c) in state.iter_mut().zip(rc.iter()) {
            *s += c;
        }
        for s in state.iter_mut() {
            *s = sbox(*s);
        }
        mat_full_4(state);
    }
}
