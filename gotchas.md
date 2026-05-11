# Gotchas

## scripts/devnet-hook/transfer.ts: missing `resize_hook_payload` call

Program flow requires: `init_hook_payload` → `resize_hook_payload` → `write_hook_proof` → `finalize_hook_payload` → `settle_hook`.

`init_hook_payload` only allocates `BASE_SPACE` (header). `resize_hook_payload` is what grows the PDA AND allocates `proof_and_witness: vec![0u8; expected]`. Skipping resize leaves the Vec at length 0, so `write_hook_proof_handler` panics at `handlers.rs:91` on `copy_from_slice` into len-0 slice with message `range end index N out of range for slice of length 0`.

For proofs > ~10 KB the client must call `resizeHookPayload()` multiple times until `data_len >= target`.

## Helius webhook auth: `Bearer ` prefix required

Indexer `verify_auth` (routes/webhook.rs) strips `Bearer ` prefix from `Authorization` header. Helius sends the auth header value verbatim, so the dashboard's "Authentication Header" field must include `Bearer ` prefix:

```
Bearer <INDEXER_HELIUS_AUTH_TOKEN value>
```

Without prefix → 401. After fix → 200.

## Frontend prove flow was missing `settle_hook` call entirely

`use-prove-flow.ts` stopped at `finalizeHookPayload`. No `settleHook`, no Token-2022 `transferChecked` triggering the hook. Result: real proofs were staged in the `hook_payload` PDA but the verifier never ran, so `ProofSettled` was never emitted and the indexer's `events` table stayed empty — even with a fully wired Helius → indexer pipeline returning 200.

Settlement path (direct call) needs ~13 accounts including `registry.merkle_tree` (fetch from chain) and PDAs `tree_config` / `tree_creator`. `buildSettleHookIx` in `sdk/src/wrap/index.ts` resolves them.

## SDK `uploadProofChunked` skipped resize step

Same bug as the original `transfer.ts`: helper exported from the SDK but built `init → write → finalize` only. Fortunately nothing outside the SDK called it, so no production impact — but the helper itself would have panicked on first use. Fixed to include `resize_hook_payload` loop matching the on-chain realloc cap (10 KiB / ix).
