# ZKSettle benchmarks

Real measurements against PRD §11 success metrics. Last updated: 2026-05-08.

---

## Test environment

| Parameter | Value |
|-----------|-------|
| CPU | Intel Core i7-11390H @ 3.40 GHz (4 cores / 8 threads) |
| RAM | 16 GB DDR4 |
| OS | Linux 7.0.3 (CachyOS) x86_64 |
| Noir | 1.0.0-beta.18 |
| Barretenberg (bb) | 3.0.0-nightly.20260102 |
| Sunspot | latest (Reilabs Groth16 compiler) |
| Circuit | `zksettle_slice` — 19,559 constraints, BN254 curve |

---

## 1. Proof generation time

### Native (CLI, x86_64)

10 sequential runs per backend. Inputs: canonical `Prover.toml` fixture (depth-20 Merkle tree, Poseidon2 hashing, 11 public inputs).

| Backend | Min | Median | Max | p95 | Target |
|---------|-----|--------|-----|-----|--------|
| Sunspot Groth16 (BN254) | 395 ms | 406 ms | 436 ms | 433 ms | < 10 s |
| UltraHonk (bb native) | 245 ms | 257 ms | 268 ms | 268 ms | — |

**Compilation:** 100 ms. **Witness generation:** 96 ms.

The Groth16 proof is the one submitted on-chain. Total native pipeline (compile + witness + prove): **~602 ms**.

### Browser (WASM, Chrome / Firefox)

> **Status: not yet measured.**
>
> Browser proof generation requires `@noir-lang/backend_barretenberg` WASM integration with a web worker pipeline (comlink). This infrastructure is tracked in issue #91 and is not yet wired into the frontend. The native Sunspot numbers above (406 ms median) represent the floor; browser WASM overhead is typically 3–8× on mid-range hardware, suggesting **1.2–3.2 s** for browser proofs — well within the < 10 s target.
>
> When the browser prover is integrated, re-run the benchmark script below to fill this table.

| Browser | Device | Min | Median | Max | p95 |
|---------|--------|-----|--------|-----|-----|
| Chrome (desktop) | — | TBD | TBD | TBD | TBD |
| Firefox (desktop) | — | TBD | TBD | TBD | TBD |
| Chrome (mobile) | — | TBD | TBD | TBD | TBD |

---

## 2. Circuit metrics

| Metric | Value |
|--------|-------|
| Constraints | 19,559 |
| ACIR opcodes | 34 |
| Expression width | 1,375 |
| Proving key size | 6.9 MB |
| Verification key size | 1.7 KB |
| Groth16 proof size | 388 bytes |
| Public witness size | 364 bytes |
| Curve | BN254 |
| Hash function | Poseidon2 |
| Merkle tree depth | 20 |
| Public inputs | 11 (8 bound in current VK) |

---

## 3. On-chain verification cost

> **Status: not yet measured on devnet.**
>
> Attempted on 2026-05-08. Blockers found:
>
> 1. **Transaction size**: `verify_proof` and `set_hook_payload` exceed the 1232-byte tx limit (proof+witness = 752B + accounts + headers). The chunked upload path (`init_hook_payload` → `write_hook_proof` → `finalize_hook_payload` → `settle_hook`) exists in the codebase but is **not deployed** — the current devnet binary predates that feature.
> 2. **Bubblegum tree init**: `init_attestation_tree` creates a depth-14 buffer-64 concurrent Merkle tree (~262KB) via CPI, which hits the 10KB inner-instruction realloc limit. The tree account must be pre-created at top level.
> 3. **Light Protocol**: `settle_core` requires initialized Light Protocol state/address trees and a validity proof for compressed account creation.
>
> **To unblock**: redeploy the program with chunked upload instructions, pre-create the Bubblegum tree account, and initialize Light Protocol state trees on devnet.
>
> The `hook-cu-probe` feature flag is in place (`cu_probe.rs`) with probes at:
> - `pre-verify_bundle` / `post-verify_bundle`
> - `post-light-cpi`
> - `pre-bubblegum-mint` / `post-bubblegum-mint`
>
> VK match confirmed: `default.vk` = `circuits/target/zksettle_slice.vk` (byte-identical). The local Sunspot proof verifies successfully against the deployed VK.

| Metric | Estimated (ADR-022) | Measured | Target |
|--------|---------------------|----------|--------|
| CU consumed (verify_proof) | 219,000 | TBD | < 250,000 |
| CU consumed (settle_hook) | 219,000 | TBD | < 250,000 |
| SOL cost per verification | < 0.001 | TBD | < 0.001 |

### CU estimation basis

ADR-022 estimates 219K CU based on:
- `alt_bn128_pairing`: ~190K CU (3 pairings for Groth16)
- `alt_bn128_addition` + `alt_bn128_multiplication`: ~10K CU
- Light Protocol CPI (nullifier): ~10K CU
- Bubblegum CPI (attestation): ~9K CU

---

## 4. Stress test: 50 concurrent transfers

> **Status: not yet executed.**
>
> The stress test requires a working end-to-end flow: SDK `wrap()` + `prove()` + on-chain `verify_proof` + settlement. The stress-test script is ready at `scripts/stress-test.ts` and will produce results once the SDK (issue #92) and demo flow (issue #93) are functional.

| Metric | Target | Measured |
|--------|--------|----------|
| Transfers attempted | 50 | TBD |
| Success rate | 100% | TBD |
| Average latency (E2E) | < 15 s | TBD |
| Total CU consumed | — | TBD |
| Failures | 0 | TBD |
| RPC errors | 0 | TBD |

---

## 5. PRD target comparison

| Metric | PRD target | Measured | Status |
|--------|------------|----------|--------|
| Browser proof generation | < 10 s | 406 ms native (WASM TBD) | On track |
| On-chain verification CU | < 250,000 | TBD (est. 219K) | Pending |
| SOL cost per verification | < 0.001 | TBD | Pending |
| E2E latency (proof + verify + settle) | < 15 s | TBD | Pending |
| 50 concurrent transfers | pass | TBD | Pending |

---

## Reproducing these benchmarks

### Native proof generation

```bash
cd circuits

# compile circuit
time nargo compile

# generate witness
time nargo execute

# Groth16 proof via Sunspot (what goes on-chain)
time sunspot prove \
  target/zksettle_slice.json \
  target/zksettle_slice.gz \
  target/zksettle_slice.ccs \
  target/zksettle_slice.pk

# verify locally
sunspot verify \
  target/zksettle_slice.vk \
  target/zksettle_slice.proof \
  target/zksettle_slice.pw
```

### On-chain CU measurement (when deployed)

```bash
cd backend

# build with CU probes
anchor build -- --features hook-cu-probe

# deploy to devnet
anchor deploy --provider.cluster devnet

# submit proof and read CU from logs
# (use scripts/stress-test.ts or manual devnet-hook/setup.ts flow)
```

### Stress test (when SDK is ready)

```bash
npx ts-node scripts/stress-test.ts \
  --mint <TOKEN_2022_MINT_PUBKEY> \
  --rpc https://api.devnet.solana.com \
  --count 50 \
  --concurrency 10
```
