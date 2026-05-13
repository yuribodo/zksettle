# Gotchas

## scripts/devnet-hook/transfer.ts: missing `resize_hook_payload` call

Program flow requires: `init_hook_payload` → `resize_hook_payload` → `write_hook_proof` → `finalize_hook_payload` → `settle_hook`.

`init_hook_payload` only allocates `BASE_SPACE` (header). `resize_hook_payload` is what grows the PDA AND allocates `proof_and_witness: vec![0u8; expected]`. Skipping resize leaves the Vec at length 0, so `write_hook_proof_handler` panics at `handlers.rs:91` on `copy_from_slice` into len-0 slice with message `range end index N out of range for slice of length 0`.

For proofs > ~10 KB the client must call `resizeHookPayload()` multiple times until `data_len >= target`.

<!-- markdownlint-disable-next-line MD038 -->
## Helius webhook auth: `Bearer ` prefix required (with trailing space)

<!-- markdownlint-disable-next-line MD038 -->
Indexer `verify_auth` (`backend/crates/indexer/src/routes/webhook.rs:107`) strips the literal 7-character prefix `Bearer ` from the `Authorization` header. The trailing space matters — Helius sends the dashboard's "Authentication Header" value verbatim, so it must be exactly:

```text
Bearer <INDEXER_HELIUS_AUTH_TOKEN value>
```

Without the prefix (or with the space missing) → 401. After fix → 200.

## Frontend prove flow was missing `settle_hook` call entirely

`use-prove-flow.ts` stopped at `finalizeHookPayload`. No `settleHook`, no Token-2022 `transferChecked` triggering the hook. Result: real proofs were staged in the `hook_payload` PDA but the verifier never ran, so `ProofSettled` was never emitted and the indexer's `events` table stayed empty — even with a fully wired Helius → indexer pipeline returning 200.

Settlement path (direct call) needs ~13 accounts including `registry.merkle_tree` (fetch from chain) and PDAs `tree_config` / `tree_creator`. `buildSettleHookIx` in `sdk/src/wrap/index.ts` resolves them.

## SDK `uploadProofChunked` skipped resize step

Same bug as the original `transfer.ts`: helper exported from the SDK but built `init → write → finalize` only. Fortunately nothing outside the SDK called it, so no production impact — but the helper itself would have panicked on first use. Fixed to include `resize_hook_payload` loop matching the on-chain realloc cap (10 KiB / ix).

## `confirmTransaction` MUST use the same blockhash the tx was signed with

In `@solana/web3.js`, `connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, commitment)` ties the wait-loop's expiry to the supplied `lastValidBlockHeight`. Confirming a tx using a **fresh** `getLatestBlockhash()` instead of the one that was set on `tx.recentBlockhash` decouples the timeout from the actual tx expiry — Solana docs explicitly warn this yields incorrect results (false timeouts or false success). The string-only deprecated overload `confirmTransaction(sig, commitment)` is safer than passing a mismatched strategy because it just polls signature status. Pattern in this repo: capture `bh = await getLatestBlockhash("confirmed")`, set `tx.recentBlockhash = bh.blockhash`, sign+send, then confirm using the *same* `bh`.

## Anchor 0.31 `new Program(idl, provider)` uses `idl.address`, not a separate `programId` arg

`@coral-xyz/anchor` 0.31 dropped the `programId` parameter from the `Program` constructor. The program address comes from `idl.address`. If a wrapper helper accepts a `programId` override and derives PDAs from it but constructs the `Program` from the raw IDL, the helper will derive PDAs for one program while encoding the instruction with the IDL's embedded address — silent mismatch. Always clone the IDL and override `idl.address = programId.toBase58()` before `new Program(...)` when honoring a programId override.

## `signAndSend` callbacks: confirmation contract must be explicit

In `ChunkedUploadOptions.signAndSend(tx) => Promise<string>` (SDK `uploadProofChunked`) the contract did not require the callback to confirm — only sign+send. Reading `getAccountInfo` immediately after a send races the network: the account may be `null` or stale, tripping the new "missing after init/resize" guards. Fix: either document confirmation as part of the callback contract, or have the SDK explicitly `await connection.confirmTransaction(sig, ...)` before reading. Picking the latter is more defensive because most wallet adapters' `signAndSendTransaction` returns after broadcast, not after confirmation.

## `write_hook_proof` ordering: confirm between writes too

The same `signAndSend`-resolves-on-broadcast hazard bites the write loop in `uploadProofChunked`. `write_hook_proof_handler` enforces `offset == high_water_mark`; if the wallet adapter returns after broadcast, the next chunk's submit can race ahead of the previous one and the program rejects it. Unlike the frontend (which sets `maxRetries: 5` on `sendRawTransaction`), the SDK has no retry path, so out-of-order arrival is unrecoverable. Confirm each chunk before the next — same pattern as init/resize. The finalize step also reads cumulative high_water_mark, so the last write must be confirmed before finalize (subsumed by per-write confirm).

## `runStepConfirm` is purely UI now — do not re-confirm

`use-prove-flow.ts` step 4 (`runStepSubmit`) already awaits `confirmTransaction` for the settle tx using its **original signing blockhash**. Re-confirming in step 5 with a fresh `getLatestBlockhash()` would re-introduce the very bug step 4 fixed (decoupled wait-loop expiry). Step 5 exists only to drive the UI step machine — keep it side-effect free.

## Groth16 proof bundle uploaded by frontend must be `proof || public-witness`, not the proof slice alone

`proveGroth16()` in `frontend/src/lib/api/endpoints.ts` returns the bundle the on-chain verifier consumes — full body, **not** `body.subarray(0, proofLen)`. The on-chain `split_proof_and_witness(data, witness_len=364)` (`programs/zksettle/src/instructions/verify_proof/helpers.rs:25`) peels the trailing 364-byte gnark public witness off and feeds the prefix to `GnarkProof::from_bytes`. If the staged `hook_payload.proof_and_witness` is only the 388-byte proof slice, the split gives a 24-byte proof prefix and `from_bytes` rejects with `ProofConversionError` (Anchor 6000 `MalformedProof`) without ever reaching the pairing check. Always upload the full 752-byte bundle (388 + 364) into `hook_payload.proof_and_witness`.

## Frontend mint/recipient limb split is the *reverse* of intuition: high 16 bytes first

`pubkey_to_limbs` (`backend/programs/zksettle/src/instructions/verify_proof/helpers.rs:32`) puts `pk.to_bytes()[0..16]` into the **HI** limb and `pk.to_bytes()[16..32]` into the **LO** limb. `check_bindings` (same dir, `bindings.rs:50`) re-derives the limbs from the *instruction-argument* mint/recipient and requires `witness.entries[MINT_LO_IDX/HI_IDX]` (and recipient) to match.

Frontend (`use-prove-flow.ts:151-`) must build the circuit inputs the same way:

```ts
const mintLo = toHex(mintBytes.slice(16, 32));  // trailing 16 → LO
const mintHi = toHex(mintBytes.slice(0, 16));   // leading 16 → HI
```

Swapping these silently passes the circuit (Noir hashes whatever it gets), so the proof verifies and the bundle deserialises — only `check_bindings` catches it, with `MintMismatch` (6009) or `RecipientMismatch` (6011) at `bindings.rs:50/61`. The nullifier hash also depends on this split, so a fix changes the nullifier value — pre-fix nullifiers in the registry stay orphaned but harmless.

## Witness `timestamp` is bound to `epoch * EPOCH_LEN_SECS`, NOT `clock.unix_timestamp`

`check_bindings` (`backend/programs/zksettle/src/instructions/verify_proof/bindings.rs:80`) requires `witness.entries[TIMESTAMP_IDX] == u64_to_field_bytes(inputs.timestamp)`. Reading `settlement.rs` / `handler.rs` cold suggests `inputs.timestamp` would be `clock.unix_timestamp` — that's how it was originally wired and it made the binding unsatisfiable: the frontend stamps `Math.floor(Date.now()/1000)` at proof-gen, and the 5–60 s gap until settle execution guaranteed `Custom(6029) TimestampMismatch` on devnet.

Both sides now derive timestamp from the witness epoch instead:

- on-chain `settlement.rs` and `handler.rs`: `timestamp = epoch.checked_mul(EPOCH_LEN_SECS as u64)`
- frontend `use-prove-flow.ts:164`: `String(Number(epoch) * 86_400)` (epoch already = `Date.now()/1000/86400`)

`validate_epoch` (`helpers.rs:14`) bounds freshness via `MAX_EPOCH_LAG=1`, but because the witness `timestamp` is the *start* of `epoch` (`epoch * 86_400`) and the Noir constraint is `timestamp <= credential_expiry` (`circuits/src/main.nr:162`), freshness has post-expiry slack of up to `(MAX_EPOCH_LAG + 1) * EPOCH_LEN_SECS` ≈ 48 h: a credential that expired near the end of epoch N-1 still verifies anywhere in epoch N because `(N-1) * 86_400 ≤ credential_expiry`. This is acceptable only while `CREDENTIAL_VALIDITY_SECS >> 48 h` — flag in audit if validity ever drops near that range. **Do not** revert the on-chain side to `clock.unix_timestamp` without flipping the frontend in lockstep.

## `settle_hook` tx MUST raise CU limit — default 200K is far too low

`settle_hook` invokes `verify_bundle` (Groth16 pairing on BN254), Light Protocol CPI, and Bubblegum CPI in a single ix. Real cost is in the millions of CU. The Solana per-tx default is 200K, so omitting `ComputeBudgetProgram.setComputeUnitLimit` makes the tx land but revert with `ProgramFailedToComplete` and a log line `consumed 199700 of 199700 compute units ... exceeded CUs meter at BPF instruction` — **not** a Custom error, so it does not trip any of the binding-mismatch (`6021..=6029`) variants and is easy to misread as a logic bug.

Fix in `frontend/src/hooks/use-prove-flow.ts` (settle batch builds with `new Transaction().add(cuLimitIx).add(cuPriceIx).add(settleIx)` where `cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })`). 1.4M is the per-tx max; do not lower without re-benchmarking the bundle. The init/resize/write/finalize batches do not need this — only the settle batch is CU-heavy.

## Prove-flow uses `"processed"` commitment for non-settle batches

`use-prove-flow.ts`'s `confirmTx` takes a `commitment` arg. Default is `"confirmed"`, but the issuer-register / stale-close pre-reqs, init+resize batch 1, the last-write confirm in batch 2, and finalize batch 3 all pass `"processed"`. Settle batch 4 keeps `"confirmed"` so the indexer keys off a confirmed `ProofSettled`. This drops ~30-45s off end-to-end on devnet vs all-confirmed.

The trade-off: a `"processed"` tx that gets forked out (rare but possible) leaves the next batch reading stale account state and failing with an account-not-ready / wrong-discriminator error. Users would need to click prove again. The fallback path in `confirmTx` (signature-status poll) is commitment-aware — when called with `"processed"` it accepts `processed | confirmed | finalized`. **Do not** weaken settle to `"processed"` — the indexer's webhook only fires on confirmed blocks.

## Prove-flow does NOT invoke `settle_hook` — Light CPI wiring still missing in SDK

The `buildSettleHookIx` SDK helper exists (`sdk/src/wrap/index.ts:266`) but the prove-flow does NOT call it. Calling it on the current SDK fails deterministically with Anchor `InvalidLightAddress (6020)` / `CpiAccountsIndexOutOfBounds(6)` from `settle_core.rs:51`, whether caught by Alchemy preflight simulation (`skipPreflight: false`) or by on-chain runtime (`skipPreflight: true`, surfaces as `InstructionError: [2, Custom(6020)]` or generic `ProgramFailedToComplete` if CU is also exhausted).

Root cause: `buildSettleHookIx` does not pass any Light Protocol CPI remaining_accounts (light system program, registered program PDA, noop, account compression program + authority, sysprog, address merkle tree, address queue, output state tree), and `DEFAULT_LIGHT_ARGS` (`sdk/src/wrap/index.ts:45`) stores zero indices + `proofPresent: false` into the `HookPayload` PDA at finalize. `settle_core` then calls `address_tree_info.get_tree_pubkey(&light_cpi_accounts)` against the empty remaining_accounts list and bombs.

The prove-flow's "Submit on-chain" step (step 4 in `use-prove-flow.ts`) intentionally ends at `finalize_hook_payload`. Re-introducing the settle batch will re-introduce the runtime failure unless the SDK is first updated to:

1. Append Light CPI remaining_accounts in the exact order `light_sdk::cpi::v2::CpiAccounts::new` expects.
2. Fetch a new-address validity proof from a Photon indexer for the derived `null_addr` / `att_addr` (`settle_core.rs:56-69`) before calling `finalize_hook_payload`, and pass real `proofBytes` + packed tree/queue/root indices via `StagedLightArgs`.

Until both pieces land, `buildSettleHookIx` should be treated as scaffolding for a future workstream, not a callable end-to-end primitive. The `ProofSettled` event will not emit and the indexer's events table will stay empty for this flow.

## Devnet congestion → final tx must carry a priority fee + maxRetries bump

On Alchemy devnet, the last tx in the prove-flow (currently finalize; settle when wired) is the most vulnerable to leader skipping. Without `ComputeBudgetProgram.setComputeUnitPrice` and `maxRetries` above the default 3, devnet leaders under load drop the tx and the 60-90s blockhash window expires before inclusion, surfacing as `TransactionExpiredBlockheightExceededError` w/ the sig never appearing on Solscan.

Current mitigation in `use-prove-flow.ts` finalize batch: `setComputeUnitPrice({ microLamports: 50_000 })` (×default 200K CU ≈ 10,000 lamports ≈ 0.00001 SOL) + `sendSigned(..., { maxRetries: 10 })`. The `confirmTx` fallback (`use-prove-flow.ts:269-302`) additionally polls `getSignatureStatus` for 30s after the blockhash strategy returns `BlockheightExceeded`, catching late inclusions. Together these reduce false-negative expiry errs to near-zero under normal devnet load. **Do not** drop either without re-benching against a busy devnet slot; the failure mode is silent (sig never lands) and very expensive to debug because both Alchemy logs and Solscan show no record of the tx.
