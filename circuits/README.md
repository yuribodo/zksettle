# zksettle thin-slice circuit

Noir 1.0.0-beta.18 circuit proving:

1. **Merkle membership** of a `wallet` leaf under a public `merkle_root`
   (depth 20, Poseidon2 hash).
2. **Nullifier derivation**: `nullifier == Poseidon2(private_key, context_hash)`.

## Public-input layout

| slot | value         |
|------|---------------|
| 0    | `merkle_root` |
| 1    | `nullifier`   |

Order is load-bearing. It must stay in sync with
`backend/programs/zksettle/src/state/pubinputs.rs` and the on-chain
`check_bindings` call in `instructions/verify_proof.rs`.

## Private inputs

`wallet`, `path[20]`, `path_indices[20]` (u1), `private_key`, `context_hash`.

## Why a hand-rolled sponge?

noir_stdlib 1.0.0-beta.18 exposes `poseidon2_permutation` publicly but marks
the `Poseidon2::hash` sponge as `pub(crate)`. `main.nr` reimplements the
sponge on top of the permutation so both the on-circuit hash and the fixture
generator in `../scripts/fixture-noir/` use the exact same parameters.

## Toolchain

- `nargo` 1.0.0-beta.18 (Noir compiler).
- `sunspot` Go CLI at rev `ce4765ccdf050507874bbb544be992a11dc48ffc`. Build
  with `cd go && go build -o sunspot .` from
  <https://github.com/reilabs/sunspot> and place the binary on `$PATH`.

## Regenerating the committed VK

`backend/programs/zksettle/default.vk` is the verifying key the on-chain
program is built against. To regenerate:

```bash
cd circuits
rm -rf target

# 1. Produce canonical public-input values for the default Prover.toml.
( cd ../scripts/fixture-noir && nargo execute )
# copy the two hex values from the `Circuit output: [..]` line into
# `merkle_root` / `nullifier` below.

# 2. Compile the circuit to ACIR JSON, then to gnark constraint system.
nargo compile
nargo execute
sunspot compile target/zksettle_slice.json
sunspot setup   target/zksettle_slice.ccs

# 3. Install the VK and (optionally) check a proof round-trip.
cp target/zksettle_slice.vk ../backend/programs/zksettle/default.vk
sunspot prove target/zksettle_slice.json target/zksettle_slice.gz \
              target/zksettle_slice.ccs target/zksettle_slice.pk
```

## Trusted setup

`sunspot setup` currently invokes `groth16.Setup` from gnark, which
generates a non-ceremonial SRS in-memory — safe for development and the
thin-slice tests but **not** for production. A real MPC ceremony (e.g.
Hermez `powersOfTau28_hez_final_14.ptau`) is out of scope for this slice;
wiring it through sunspot is future work.

## CI determinism

Given the same ACIR (`target/zksettle_slice.json`) and the same sunspot
revision, `target/zksettle_slice.vk` is deterministic. A good invariant for
CI: regenerate and diff against `backend/programs/zksettle/default.vk`;
unexpected drift is a review signal.

## Regenerating the integration-test artifacts

The ignored tests in `backend/programs/zksettle/tests/` assume the
`target/zksettle_slice.{json,ccs,pk}` artifacts above exist. After the
steps in “Regenerating the committed VK”, the tests shell out to `nargo
execute` + `sunspot prove` themselves. Run with:

```bash
cd backend && anchor build
cd programs/zksettle && cargo test -- --ignored
```
