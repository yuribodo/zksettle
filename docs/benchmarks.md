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

> **Status: ready to measure.**
>
> The chunked upload flow (`init_hook_payload` → `write_hook_proof` → `finalize_hook_payload` → `settle_hook`) is deployed and available in both the program and SDK. The benchmark script uploads the proof in chunks, then simulates (or executes) `settle_hook` to measure CU consumed by gnark Groth16 verification.
>
> **Previous blockers (resolved):**
> 1. ~~Transaction size~~ — chunked upload bypasses the 1232-byte limit
> 2. ~~Bubblegum tree init~~ — handled by `setup.ts` (top-level account creation)
> 3. **Light Protocol** — `settle_hook` still requires Light state trees to be initialized for full execution; simulation measures gnark CU before the Light CPI boundary
>
> The `hook-cu-probe` feature flag is in place (`cu_probe.rs`) with probes at:
> - `pre-verify_bundle` / `post-verify_bundle`
> - `post-light-cpi`
> - `pre-bubblegum-mint` / `post-bubblegum-mint`
>
> VK match confirmed: `default.vk` = `circuits/target/zksettle_slice.vk` (byte-identical).

| Metric | Estimated (ADR-022) | Measured | Target |
|--------|---------------------|----------|--------|
| CU consumed (settle_hook: verify + light + bubblegum) | ~219,000 | TBD | < 250,000 |
| SOL cost per verification | < 0.001 | TBD | < 0.001 |

### CU estimation basis

ADR-022 estimates 219K CU based on:
- `alt_bn128_pairing`: ~190K CU (3 pairings for Groth16)
- `alt_bn128_addition` + `alt_bn128_multiplication`: ~10K CU
- Light Protocol CPI (nullifier): ~10K CU
- Bubblegum CPI (attestation): ~9K CU

### SOL cost methodology

SOL cost per verification = base fee + priority fee:
- **Base fee**: 5,000 lamports (fixed per signature)
- **Priority fee**: CU × priority rate (µ-lamports/CU)
- **Rate used**: 5,000 µ-lamports/CU (conservative devnet upper bound)
- **Formula**: `(5000 + CU × 5000 / 1e6) / 1e9` SOL

At the estimated 219K CU: `(5000 + 1095) / 1e9 ≈ 0.000006 SOL` — well within < 0.001 target.

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

### On-chain CU measurement

```bash
# Standalone (registers issuer, uploads proof, simulates settle_hook)
ANCHOR_WALLET=~/.config/solana/id.json npx ts-node scripts/benchmark-cu.ts

# With devnet-state.json (uses setup.ts accounts)
cd scripts/devnet-hook
ANCHOR_WALLET=~/.config/solana/id.json npx ts-node benchmark-cu.ts

# Options:
#   --runs 10       Number of benchmark iterations (default: 5)
#   --live          Execute on-chain instead of simulating
#   --rpc <url>     Custom RPC endpoint
```

### Stress test (when SDK is ready)

```bash
npx ts-node scripts/stress-test.ts \
  --mint <TOKEN_2022_MINT_PUBKEY> \
  --rpc https://api.devnet.solana.com \
  --count 50 \
  --concurrency 10
```
