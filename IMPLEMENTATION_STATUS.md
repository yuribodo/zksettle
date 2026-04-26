# ZKSettle — Implementation Status

**Snapshot date:** 2026-04-23
**Week:** 2 of 5 (PRD §12)
**Submission target:** 2026-05-11 (18 days remaining)
**Branch at snapshot:** `ci/sonarqube-dev-branch`

This document is the ground truth for what exists in the repository today versus what is still planned in `README.md`, `zksettle_prd.md`, and `zksettle_adr.md`. It is not a roadmap — it is a reconciliation.

---

## TL;DR

| Layer | Component | Status |
|---|---|---|
| ZK | Noir compliance circuit | **DONE** (5 checks, 11 public inputs, 163 LOC; VK binds 8 of 11) |
| ZK | Groth16 / Sunspot VK pipeline | **DONE** |
| On-chain | Anchor program scaffold | **DONE** |
| On-chain | `register_issuer` / `update_issuer_root` | **DONE** |
| On-chain | `verify_proof` + nullifier PDA | **DONE** |
| On-chain | `Attestation` PDA + `ProofSettled` event | **DONE** |
| On-chain | Token-2022 Transfer Hook | **DONE (partial)** (staging + settle + execute + atomicity gate wired; fixtures pending) |
| On-chain | `check_attestation` ix | **DONE** |
| On-chain | Light Protocol compression (real) | **DONE** (write path + read path migrated; integration fixtures TODO) |
| On-chain | Bubblegum cNFT attestation | **DONE** (`init_attestation_tree` + post-Light `MintV1` CPI; ADR-019) |
| Crate | `zksettle-types` | **DONE** (accounts, credential, events, gateway types, policy) |
| Crate | `zksettle-crypto` | **DONE** (Poseidon2, MerkleTree, SparseMerkleTree, tests) |
| Crate | `issuer-service` | **DONE (scaffold)** (Axum HTTP, Solana RPC, credential + tree management) |
| Crate | `indexer` | **DONE (scaffold)** (Helius webhook, RocksDB dedup, Irys upload) |
| Crate | `api-gateway` | **DONE (scaffold)** (auth, rate limit, metering, proxy) |
| Crate | `sanctions-updater` | **DONE (scaffold)** (OFAC fetch, SMT build, on-chain publish) |
| SDK | `@zksettle/sdk` (prove / wrap / audit) | **TODO** |
| Frontend | Dashboard (Vite + React) | **TODO** |
| Tests | Anchor program tests | **DONE (partial coverage)** |
| Tests | E2E (Playwright) | **TODO** |
| Infra | pnpm workspace | **TODO** |
| Docs | README / PRD / ADR alignment | **DONE** (updated 2026-04-23) |

---

## 1. What is implemented

### 1.1 ZK circuit — `circuits/`

- `circuits/src/main.nr` (163 LOC) — Full compliance circuit: Merkle membership (depth 20), sanctions exclusion (SMT non-membership), jurisdiction check (Merkle membership), credential expiry, and bound nullifier derivation. 11 public inputs, 5 checks. Uses Poseidon2 sponge over `poseidon2_permutation`.
- `circuits/Nargo.toml`, `circuits/README.md` in place.
- Fixture generator at `scripts/fixture-noir/` with its own `Nargo.toml` + `Prover.toml` for producing test vectors.

### 1.2 Sunspot / VK pipeline

- `backend/programs/zksettle/default.vk` (binary, 780 B) — committed verification key.
- `backend/programs/zksettle/src/generated_vk.rs` (4.1 KB) — Rust constants regenerated from `default.vk` by `build.rs`. `nr_pubinputs = 8` (merkle_root, nullifier, mint_lo, mint_hi, epoch, recipient_lo, recipient_hi, amount). Indices 8–10 (sanctions_root, jurisdiction_root, timestamp) await VK regeneration after circuit update.
- `placeholder-vk` Cargo feature available for local/test use against the placeholder circuit.

### 1.3 Anchor program — `backend/programs/zksettle/src/`

Wired instructions (all three present in `lib.rs`, 896 B):

- `register_issuer` — `instructions/register_issuer.rs` (1.6 KB). Creates issuer PDA with pubkey + Merkle root.
- `update_issuer_root` — shares the issuer instruction module; authority-gated root rotation.
- `verify_proof` — `instructions/verify_proof.rs` (6.4 KB). Parses proof + public inputs, binds `merkle_root` to the registered issuer and `nullifier` to a fresh PDA, delegates pairing check to the Reilabs `gnark-verifier-solana` (Sunspot) crate, consumes the nullifier, initializes an `Attestation` PDA (`[ATTESTATION_SEED, issuer, nullifier_hash]`) with `{issuer, nullifier_hash, merkle_root, slot, payer, bump}`, and emits a `ProofSettled` event for off-chain indexing.

State accounts (`state/`):

- `state/issuer.rs` — issuer PDA layout.
- `state/nullifier.rs` — nullifier PDA layout (stand-in for eventual Light Protocol compressed account).
- `state/attestation.rs` — `Attestation` PDA layout (emitted per successful verify).
- `state/pubinputs.rs` — `MERKLE_ROOT_IDX`, `NULLIFIER_IDX` constants.

Errors: `error.rs` (37 variants including Light Protocol, Bubblegum, Transfer Hook, and binding errors).

### 1.4 Anchor tests — `backend/programs/zksettle/tests/`

- `light_smoke.rs` — `LightProgramTest` harness. Boots `zksettle.so`, exercises `register_issuer` (happy path + `ZeroMerkleRoot` guard) and `update_issuer_root` (happy path + wrong-authority rejection via Anchor `ConstraintSeeds`). Gated behind `--features light-tests`; requires the `light` CLI binary on `PATH`.

The legacy litesvm suite (`register_issuer.rs`, `verify.rs`, `nullifier.rs`, `check_attestation.rs`, `common/`) was removed when `verify_proof` / `check_attestation` moved to Light CPI — the rent-funded PDA path they exercised no longer exists. End-to-end coverage of the Light-CPI instructions is tracked as the ADR-006 fixture-crate follow-up (see §2.2).

### 1.5 Documentation

- `README.md`, `zksettle_prd.md`, `zksettle_adr.md`, `zksettle_pitch.md` all present at repo root.

---

## 2. Partial / caveats

### 2.1 Circuit vs VK gap

`main.nr` implements all five PRD §7 checks (membership, sanctions exclusion, jurisdiction, expiry, nullifier) with 11 public inputs. However, `generated_vk.rs` currently binds only 8 public inputs (indices 0–7). The three remaining indices (8: sanctions_root, 9: jurisdiction_root, 10: timestamp) require a VK regeneration via the Sunspot pipeline (`nargo compile` → `sunspot compile` → `sunspot setup` → `build.rs`). Until then, the on-chain verifier does not validate sanctions/jurisdiction/timestamp bindings — those checks run in the circuit but the proof is generated against the 8-input VK.

### 2.2 Light Protocol migration — code done, fixtures pending

ADR-006 / ADR-007 call for Light Protocol ZK Compression. `verify_proof` now writes both nullifier and attestation as Light compressed accounts (`LightAccount::new_init` + `LightSystemProgramCpi::invoke`); `check_attestation` reads via `LightAccount::new_read_only`. The legacy rent-funded PDA path is removed.

What's still missing: **integration-test coverage of the Light-CPI paths**. `tests/light_smoke.rs` only exercises the pure-Anchor instructions (`register_issuer`, `update_issuer_root`) through `LightProgramTest`. `verify_proof` / `check_attestation` need a dedicated fixture crate wiring gnark proof + witness bytes into a compressed-account setup with a running prover server. Tracked as ADR-006 follow-up.

### 2.3 Light compressed attestation + Bubblegum cNFT (ADR-019)

`verify_proof` and the hook settlement path write **Light** compressed nullifier + `CompressedAttestation`, then mint a **Bubblegum** compressed NFT to `recipient` in the same instruction. The cNFT is a wallet-visible supplement (DAS); authoritative replay binding remains the Light nullifier + compressed attestation layout in `state/compressed.rs`. Indexers should treat **DAS / Merkle proofs** as the read model for the cNFT; on-chain programs that need a hard gate continue to use `check_attestation` or policy on supplied proofs.

---

## 3. Missing — grouped by layer

### 3.1 On-chain (Anchor program)

- **Merkle root staleness check** — `verify_proof` rejects with `RootStale` once `issuer.root_slot` lags the current slot by more than `MAX_ROOT_AGE_SLOTS` (~48h at 400ms/slot). See ADR-021. **DONE.**
- **Zero-nullifier guard** — `verify_proof` rejects `nullifier_hash == [0u8; 32]` with `ZeroNullifier`, mirroring the `ZeroMerkleRoot` guard at issuer registration. **DONE.**
- **Nullifier context binding (ADR-020)** — circuit now derives `nullifier = Poseidon2(private_key, mint_lo, mint_hi, epoch, recipient_lo, recipient_hi, amount)` with all six limbs exposed as public inputs (BN254 fits them via 128-bit pubkey limb split). `verify_proof` rebinds these via `check_bindings` and guards epoch freshness (`EpochInFuture` / `EpochStale`, `MAX_EPOCH_LAG = 1`). Attestation PDA + `ProofSettled` event carry the tuple for off-chain indexing. **DONE.**
- **CU budget bumped to <250K** per ADR-022 (post-ADR-020 pub-input fan-out). Measured: 219,767 CU. Safety ceiling in tests: 600K.
- **Token-2022 Transfer Hook** (ADR-005, RF-03). `transfer_hook`, `settle_hook`, `set_hook_payload`, and `init_extra_account_meta_list` instructions wired in `lib.rs`. Two-phase flow: client stages proof + Light args via `set_hook_payload` and Token-2022 Execute (or direct `settle_hook`) consumes the payload, runs `verify_bundle`, and mints compressed nullifier + attestation via Light CPI. Atomicity enforced via `spl_token_2022::extension::transfer_hook::TransferHookAccount.transferring` gate + source-token owner-program + base-owner checks. Known trade-off: single outstanding payload per authority (TLV resolution only sees `amount: u64` + account keys, so PDAs cannot be nullifier-seeded). Hook-path payload PDA closure resolved via standalone `close_hook_payload` instruction — authority calls it post-transfer to reclaim rent and unblock the next `set_hook_payload`. **DONE (partial).** Remaining gap: gnark fixture + Token-2022 mint configured with the hook to lift the `#[ignore]` on `transfer_hook_smoke.rs`; hook-path CU measurement vs ADR-022 ceiling (probe feature `hook-cu-probe` exists, value unrecorded).
- **`check_attestation(nullifier_hash)`** instruction (PRD §7 Componente 2, RF-02). Validates attestation PDA freshness within `MAX_ROOT_AGE_SLOTS`; emits `AttestationChecked` event. CPI-callable by transfer hooks / other programs. **DONE.**
- **Light Protocol integration** (ADR-006). Write + read paths migrated; integration fixtures (gnark proof bytes + compressed-account setup + prover server) are the remaining gap — see §2.2.
- ~~**Bubblegum cNFT attestation** (ADR-019 / README Components row).~~ **DONE:** `init_attestation_tree`, registry PDA, raw Bubblegum CPI module, `verify_proof` + `settle_hook` + `transfer_hook` (TLV tail) wiring. **Remaining:** end-to-end harness with Bubblegum programs loaded + gnark fixture to assert mint in CI; `cargo test --features light-tests` integration tests are **Unix-only** dev-deps (`light-program-test` pulls OpenSSL; Windows devs use WSL or omit the feature).

### 3.2 Rust crates — `backend/crates/`

All six crates are scaffolded and compile as workspace members (`backend/Cargo.toml` lists `crates/*`):

- `zksettle-types` — **Done.** Shared account layouts (Issuer, CompressedAttestation, CompressedNullifier), credential types, events (AttestationChecked, ProofSettled), gateway types (ApiKeyRecord, Tier, UsageRecord), policy schema.
- `zksettle-crypto` — **Done.** Poseidon2 sponge (matching circuit), MerkleTree (depth 20), SparseMerkleTree with non-membership proofs. Unit tests passing.
- `issuer-service` — **Scaffold done.** Axum HTTP server, Solana RPC integration, credential issuance + tree management routes. Needs integration testing.
- `indexer` — **Scaffold done.** Helius webhook routes, RocksDB-backed NullifierStore for dedup, IrysClient for Arweave uploads. Needs end-to-end testing.
- `api-gateway` — **Scaffold done.** Auth (API key), rate limiting (governor), metering (usage tracking), proxy to issuer-service. Needs integration testing.
- `sanctions-updater` — **Scaffold done.** OFAC CSV fetch, SMT root computation, on-chain publication via Solana RPC. Needs integration testing.

### 3.3 Client

- **`sdk/`** — no TypeScript SDK. No `prove()`, `wrap()`, `audit()`. RF-04 unstarted.
- **`frontend/`** — no Vite + React dashboard. RF-06 unstarted.
- **`tests/`** — no Playwright E2E harness.
- **`pnpm-workspace.yaml`** — absent; only `backend/package.json` exists today.

---

## 4. PRD §12 checklist

### Week 1 (11–17 Apr) — Fundação

- [x] Noir + Sunspot hello world verified
- [x] Anchor scaffold + `register_issuer`
- [ ] USDC-test mint with Transfer Hook enabled on devnet
- [x] Credential schema + Merkle tree fixture (`scripts/fixture-noir/`)
- [x] Public repo + README + CI (implied by branch activity)

### Week 2 (18–24 Apr) — Core ZK (in progress)

- [~] Circuit complete: membership + nullifier **done**; sanctions + jurisdiction + expiry **todo**
- [x] Groth16 compile + VK generated (`default.vk` → `generated_vk.rs`)
- [x] `verify_proof` with `alt_bn128` via Sunspot crate
- [~] Transfer Hook + Light Protocol nullifier tracking — wiring done (stage + execute/settle + Light-CPI compressed nullifier + atomicity gate); gnark fixture + hook-configured Token-2022 mint pending
- [ ] **Friday checkpoint:** end-to-end browser proof → on-chain verify

### Week 3 (25 Apr – 1 May) — Produto

- [ ] Browser proof generation (Noir WASM)
- [ ] `@zksettle/sdk` (`prove`, `wrap`, `audit`)
- [ ] Issuer mock script + dashboard live feed
- [ ] **Friday checkpoint:** full approve + reject demo

### Week 4 (2–8 May) — Pitch

- [ ] Demo video (2–3 min)
- [ ] Pitch video (3 min)
- [ ] Benchmarks with real CU / latency numbers
- [ ] One-page integration guide
- [ ] Stress test 50 concurrent transfers

### 11 May — Submission

- [ ] Public repo with full README
- [ ] Pitch video ≤ 3 min
- [ ] Demo ≤ 3 min
- [ ] Devnet deployment live
- [ ] SDK published to npm

---

## 5. Critical path / blockers

1. **ADR-002 trusted setup ceremony** — `circuits/README.md` notes the current SRS is gnark's in-memory default; ADR-002 mandates Hermez Powers of Tau for production. No MPC ceremony integration yet. Production-deploy gate.
2. ~~**Transfer Hook**~~ — on-chain wiring resolved: staging + settle/execute + Light-CPI compressed nullifier + `TransferHookAccount.transferring` atomicity gate. Remaining demo-blockers: gnark fixture bytes + Token-2022 mint configured with the hook to exercise `transfer_hook_smoke.rs`, and end-to-end browser proof → transfer flow.
3. ~~**`zksettle-types` + `zksettle-crypto`**~~ — **Resolved.** Both crates scaffolded with full module structure, types, and tests.
4. **Issuer service + SDK prove path** — issuer-service scaffolded; SDK not yet started. Together they unlock the first end-to-end proof → verify flow. Target before Week 3 Friday checkpoint.
5. **Indexer consuming `ProofSettled`** — event is already emitted; indexer scaffolded with Helius webhook routes + Irys client. Needs end-to-end integration testing.
6. **VK regeneration** — circuit implements all 5 checks with 11 public inputs, but VK binds only 8. Need Sunspot pipeline run to regenerate VK with full 11-input circuit before Week 4.

---

## 6. Documentation drift

**Resolved 2026-04-23:** README, PRD, and ADR files updated to reflect current codebase state. Key fixes: circuit description updated (5 checks, 11 pubinputs), crate statuses corrected (all scaffolded), `register_issuer` signature updated (3 roots), Poseidon → Poseidon2, ADR-013/019/020 statuses marked as implemented, repo layout reflects actual directories.

---

## 7. Acceptance criteria for this document

- Every **DONE** entry points at a path that exists in the working tree.
- Every **TODO** entry maps to a numbered requirement in `zksettle_prd.md` or an ADR in `zksettle_adr.md`.
- Future updates: append a dated entry at the top of §4 checklist rather than rewriting history, so week-over-week progress remains auditable.

---

## 8. Drift verdict — code vs docs

For each divergence between the repository and `README.md` / `zksettle_prd.md` / `zksettle_adr.md`, pick a winner and an action. "Code wins" means the docs lag reality and should be updated. "Docs win" means the code is incomplete or off-spec and should be finished. "Doc self-conflict" means README and PRD disagree with each other, not with code.

| # | Divergence | Winner | Action |
|---|---|---|---|
| 1 | README L123 warns circuit is `x*x == y` placeholder; actual `main.nr` is Merkle + nullifier slice (commit `ce658e2`). | **Code** | Remove the warning paragraph; keep the VK-regen note. |
| 2 | `update_issuer_root` instruction shipped (commit `19fddce`) but not listed in PRD RF-02 or README Components row. | **Code** | Add `update_issuer_root` to PRD RF-02 and to the README Components row for the Anchor program. |
| 3 | Nullifier and attestation use vanilla Anchor PDAs; ADR-006 / ADR-007 mandate Light Protocol ZK Compression. | **Docs (long-term)** | Keep PDA stand-ins through the hackathon demo; open a migration ticket before mainnet. Rent at 50 k proofs/month = ~100 SOL/month, not acceptable at scale. |
| 4 | ~~`verify_proof` emits no attestation.~~ | **Resolved** | Light compressed nullifier + attestation + `ProofSettled` event. Bubblegum cNFT mint (ADR-019) implemented after Light CPI. |
| 5 | `scripts/fixture-noir/` ships a fixture generator; not in README repo-layout tree. | **Code** | Add `scripts/fixture-noir/` to the README layout block. |
| 6 | README §Technology stack + repo layout call the dashboard "Vite + React"; PRD §8 calls it "Next.js + TypeScript". No frontend code yet. | **Doc self-conflict** | Pick **Vite + React** (SPA dashboard, no SSR requirement, smaller bundle, faster dev loop). Update PRD §8 to match README before scaffolding. |
| 7 | ~~`check_attestation(wallet)` absent from `lib.rs`.~~ | **Resolved** | `check_attestation(nullifier_hash)` implemented. Validates attestation freshness via `MAX_ROOT_AGE_SLOTS`, emits `AttestationChecked`. CPI-ready for transfer hooks. |
| 8 | ~~Token-2022 Transfer Hook missing entirely; ADR-005 calls it non-bypassable core.~~ | **Resolved** | `set_hook_payload` + `init_extra_account_meta_list` + `settle_hook` + `transfer_hook` + `close_hook_payload` wired. Atomicity enforced via `spl_token_2022::extension::transfer_hook::TransferHookAccount.transferring` gate in `execute_hook_handler`. Compressed nullifier + attestation minted via Light CPI. Hook-path rent reclaimed via `close_hook_payload`. Integration fixture still pending. |
| 9 | `circuits/README.md` documents the SRS as gnark's in-memory default; ADR-002 mandates Hermez Powers of Tau for production. | **Docs** | Open a ceremony ticket; gate mainnet deploy on MPC integration. Hackathon demo may ship without it, production may not. |

### Docs adjusted (2026-04-23)

- `README.md`: thin-slice warning replaced with current circuit status (5 checks, 11 pubinputs, VK binds 8); `init_attestation_tree` added to Components; Anchor version 0.31; hash function Poseidon2; repo layout updated (removed nonexistent dirs, added `docs/`, `IMPLEMENTATION_STATUS.md`); ADR description updated.
- `zksettle_prd.md`: `register_issuer` / `update_issuer_root` signatures updated to 3 roots; public inputs section rewritten (11 fields); §15.5, §15.11, §15.12 marked as implemented; Poseidon → Poseidon2.
- `zksettle_adr.md`: ADR-004 Poseidon → Poseidon2 with implementation note; ADR-013 status → Decidido/implementado; ADR-019 summary priority → Decidido; ADR-004 summary table updated.
