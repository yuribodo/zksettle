# ZKSettle — Implementation Status

**Snapshot date:** 2026-04-19
**Week:** 2 of 5 (PRD §12)
**Submission target:** 2026-05-11 (22 days remaining)
**Branch at snapshot:** `chore/circuit-fixture-sync`

This document is the ground truth for what exists in the repository today versus what is still planned in `README.md`, `zksettle_prd.md`, and `zksettle_adr.md`. It is not a roadmap — it is a reconciliation.

---

## TL;DR

| Layer | Component | Status |
|---|---|---|
| ZK | Noir compliance circuit | **DONE (thin slice)** |
| ZK | Groth16 / Sunspot VK pipeline | **DONE** |
| On-chain | Anchor program scaffold | **DONE** |
| On-chain | `register_issuer` / `update_issuer_root` | **DONE** |
| On-chain | `verify_proof` + nullifier PDA | **DONE** |
| On-chain | `Attestation` PDA + `ProofSettled` event | **DONE** |
| On-chain | Token-2022 Transfer Hook | **TODO** |
| On-chain | `check_attestation` ix | **TODO** |
| On-chain | Light Protocol compression (real) | **TODO** (PDA stand-in only) |
| On-chain | Bubblegum cNFT attestation | **TODO** |
| Crate | `zksettle-types` | **TODO** |
| Crate | `zksettle-crypto` | **TODO** |
| Crate | `issuer-service` | **TODO** |
| Crate | `indexer` | **TODO** |
| Crate | `api-gateway` | **TODO** |
| Crate | `sanctions-updater` | **TODO** |
| SDK | `@zksettle/sdk` (prove / wrap / audit) | **TODO** |
| Frontend | Dashboard (Vite + React) | **TODO** |
| Tests | Anchor program tests | **DONE (partial coverage)** |
| Tests | E2E (Playwright) | **TODO** |
| Infra | pnpm workspace | **TODO** |
| Docs | README placeholder warning | **STALE** (see §6) |

---

## 1. What is implemented

### 1.1 ZK circuit — `circuits/`

- `circuits/src/main.nr` (98 LOC) — Merkle membership (depth 20) + nullifier derivation using Poseidon2 sponge. Real compliance slice, replaces the `x*x == y` placeholder (commit `ce658e2`).
- `circuits/Nargo.toml`, `circuits/README.md` in place.
- Fixture generator at `scripts/fixture-noir/` with its own `Nargo.toml` + `Prover.toml` for producing test vectors.

### 1.2 Sunspot / VK pipeline

- `backend/programs/zksettle/default.vk` (binary, 780 B) — committed verification key.
- `backend/programs/zksettle/src/generated_vk.rs` (4.1 KB) — Rust constants regenerated from `default.vk` by `build.rs`. `nr_pubinputs = 2` (merkle_root, nullifier).
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

Errors: `error.rs` (592 B, 7 variants).

### 1.4 Anchor tests — `backend/programs/zksettle/tests/`

- `register_issuer.rs` (5.4 KB)
- `verify.rs` (5.0 KB)
- `nullifier.rs` (6.0 KB) — covers replay rejection
- `common/` helpers

Total ~482 LOC of on-chain test coverage.

### 1.5 Documentation

- `README.md`, `zksettle_prd.md`, `zksettle_adr.md`, `zksettle_pitch.md` all present at repo root.

---

## 2. Partial / caveats

### 2.1 Circuit is a thin slice

`main.nr` proves Merkle membership + nullifier only. Still missing from the PRD §7 circuit spec:

- Sanctions exclusion (Sparse Merkle non-membership against OFAC root).
- Jurisdiction check (either hashed set or Merkle root per ADR-013).
- Credential expiry.
- Public inputs: `timestamp`, `jurisdiction_set_hash` / `jurisdiction_root`, `schema_version`.

`generated_vk.rs` is bound to the current 2-pubinput slice — extending the circuit requires regenerating the VK via `build.rs`.

### 2.2 Nullifier storage is not real Light Protocol

ADR-006 / ADR-007 call for Light Protocol ZK Compression. Current implementation creates a vanilla PDA per nullifier. Functionally anti-replay works; economically it does not scale per ADR-006 rationale.

### 2.3 Attestation record = PDA, not cNFT

`verify_proof` now writes an `Attestation` PDA and emits `ProofSettled` — RF-02 and UC-01.7 satisfied at the Anchor-account level. Bubblegum cNFT form (ADR-019) is still future work. Indexer consumes `ProofSettled` event; no CPI contract yet for consumer programs (see §3.1 `check_attestation`).

---

## 3. Missing — grouped by layer

### 3.1 On-chain (Anchor program)

- **Merkle root staleness check** — `verify_proof` rejects with `RootStale` once `issuer.root_slot` lags the current slot by more than `MAX_ROOT_AGE_SLOTS` (~48h at 400ms/slot). See ADR-021. **DONE.**
- **Zero-nullifier guard** — `verify_proof` rejects `nullifier_hash == [0u8; 32]` with `ZeroNullifier`, mirroring the `ZeroMerkleRoot` guard at issuer registration. **DONE.**
- **Nullifier context binding (ADR-020)** — circuit now derives `nullifier = Poseidon2(private_key, mint_lo, mint_hi, epoch, recipient_lo, recipient_hi, amount)` with all six limbs exposed as public inputs (BN254 fits them via 128-bit pubkey limb split). `verify_proof` rebinds these via `check_bindings` and guards epoch freshness (`EpochInFuture` / `EpochStale`, `MAX_EPOCH_LAG = 1`). Attestation PDA + `ProofSettled` event carry the tuple for off-chain indexing. **DONE.**
- **CU budget bumped to <250K** per ADR-022 (post-ADR-020 pub-input fan-out). Measured: 219,767 CU. Safety ceiling in tests: 600K.
- **Token-2022 Transfer Hook** (ADR-005, RF-03). No `transfer_hook` instruction, no `ExtraAccountMetaList` account, no mint configured with the hook. This is the Week 2 Friday checkpoint blocker.
- **`check_attestation(wallet)`** instruction (PRD §7 Componente 2, RF-02). Attestation PDA exists; lookup-by-wallet / CPI contract does not.
- **Light Protocol integration** (ADR-006). Both nullifier and attestation use vanilla PDAs.
- **Bubblegum cNFT attestation** (ADR-019 / README Components row).

### 3.2 Rust crates — `backend/crates/` (directory does not exist)

None of the six crates promised by the README layout exist:

- `zksettle-types` — shared account layouts, attestation schema, policy types. Blocks everything downstream.
- `zksettle-crypto` — Poseidon, Merkle tree, SMT wrappers (mirrors in-circuit hashing).
- `issuer-service` — HTTP service, credential issuance, Merkle tree maintenance, root publication via `register_issuer` / `update_issuer_root`.
- `indexer` — Helius webhook consumer → Arweave via Irys.
- `api-gateway` — billing, rate limiting, tier enforcement (ADR-008).
- `sanctions-updater` — OFAC cron → SMT root update → on-chain publish.

`backend/Cargo.toml` workspace currently lists `programs/` only — needs `crates/*` added when they land.

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
- [ ] Transfer Hook + Light Protocol nullifier tracking (PDA stand-in only)
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
2. **Transfer Hook** — without it the entire atomicity story of ADR-005 collapses and no end-to-end demo is possible. Highest priority.
3. **`zksettle-types` + `zksettle-crypto`** — every off-chain service plus the SDK need shared types and Poseidon-compatible Merkle/SMT utilities. Scaffold these before issuer-service to avoid rework.
4. **Issuer service + SDK prove path** — together they unlock the first end-to-end proof → verify flow. Target before Week 3 Friday checkpoint.
5. **Indexer consuming `ProofSettled`** — event is already emitted; needs Helius webhook subscriber + Arweave persister to close the RF-06 loop.
6. **Circuit extension** — sanctions, jurisdiction, expiry. Each added public input forces a VK regen; budget for at least one full rebuild before Week 4.

---

## 6. Documentation drift

`README.md` lines 122–123 still warn:

> ⚠️ Thin-slice placeholder: `circuits/src/main.nr` currently implements `x*x == y` only.

This is stale as of commit `ce658e2` — the file now contains the Merkle + nullifier slice. The README should be updated in a separate commit (out of scope for this doc). The VK caveat in the same block is still accurate: any circuit change requires regenerating `generated_vk.rs`.

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
| 4 | ~~`verify_proof` emits no attestation.~~ | **Resolved** | `Attestation` PDA + `ProofSettled` event implemented. Bubblegum cNFT form (ADR-019) still on roadmap. |
| 5 | `scripts/fixture-noir/` ships a fixture generator; not in README repo-layout tree. | **Code** | Add `scripts/fixture-noir/` to the README layout block. |
| 6 | README §Technology stack + repo layout call the dashboard "Vite + React"; PRD §8 calls it "Next.js + TypeScript". No frontend code yet. | **Doc self-conflict** | Pick **Vite + React** (SPA dashboard, no SSR requirement, smaller bundle, faster dev loop). Update PRD §8 to match README before scaffolding. |
| 7 | `check_attestation(wallet)` absent from `lib.rs`; promised by PRD RF-02 and README Components row. | **Docs** | Implement: iterate attestation PDAs for a wallet, or add reverse index. Needed for DeFi CPI consumers. |
| 8 | Token-2022 Transfer Hook missing entirely; ADR-005 calls it non-bypassable core. | **Docs** | Implement `transfer_hook` + `ExtraAccountMetaList` in the Anchor program. Week 2 Friday checkpoint blocker. |
| 9 | `circuits/README.md` documents the SRS as gnark's in-memory default; ADR-002 mandates Hermez Powers of Tau for production. | **Docs** | Open a ceremony ticket; gate mainnet deploy on MPC integration. Hackathon demo may ship without it, production may not. |

### Docs adjusted in this pass

- `README.md`: stale placeholder warning removed; `scripts/fixture-noir/` added to the repo layout; Components row for the Anchor program updated to include `update_issuer_root`.
- `zksettle_prd.md`: RF-02 extended with `update_issuer_root`; §8 frontend row switched to Vite + React for alignment with the README.

### Docs still to adjust (out of scope for this pass)

- `zksettle_adr.md`: add a short ADR (ADR-021 proposed) covering root rotation via `update_issuer_root` and the PDA-nullifier-as-stopgap decision referencing ADR-006.
