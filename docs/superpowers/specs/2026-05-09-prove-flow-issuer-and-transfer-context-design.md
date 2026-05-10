# Prove Flow: Issuer Registration & Transfer Context Inputs

## Problem

The prove flow fails with `WalletSendTransactionError` at `uploadProofChunked` because:

1. **Missing Issuer PDA** — `initHookPayload` requires an `Issuer` account seeded by the signer's pubkey. If the wallet isn't registered as an issuer, the transaction fails with an account-not-found constraint violation.
2. **Placeholder transfer context** — `mint` and `recipient` in both proof generation and `transferContext` are hardcoded to the connected wallet's `publicKey`. The mint should be a real stablecoin mint address and the recipient should be the actual transfer destination.

## Design

### 1. SDK: Browser-compatible issuer utilities

Add to `sdk/src/wrap/index.ts`:

**`buildRegisterIssuerIx(wallet, roots, connection, programId?, program?)`**
- Builds a `registerIssuer` instruction using `loadAnchorBrowser` (no Node deps).
- Takes `IssuerRoots` (merkle, sanctions, jurisdiction as `Uint8Array[32]`).
- Returns `TransactionInstruction`.

**`checkIssuerExists(wallet, connection, programId?)`**
- Derives the issuer PDA via `findIssuerPda`.
- Calls `connection.getAccountInfo(issuerPda)`.
- Returns `boolean`.

Both exported from `sdk/src/index.ts`.

### 2. Frontend: Auto-register issuer before proof upload

In `use-prove-flow.ts`, inside `runStepSubmit`, before `uploadProofChunked`:

1. Import `checkIssuerExists` and `buildRegisterIssuerIx` from `@zksettle/sdk`.
2. Call `checkIssuerExists(publicKey, connection)`.
3. If `false`, parse the hex roots from `submitCtx.roots` into `Uint8Array[32]`, build and send a `registerIssuer` transaction via `signAndSend`.
4. Proceed with `uploadProofChunked`.

The roots are already available from step 2 (`runStepMerklePaths` returns `roots`). They need to be threaded through to `runStepSubmit` via `submitCtx`.

### 3. Frontend: Transfer context form inputs

**IntroCard** gets a mini-form with three fields:
- **Recipient** — Solana address input (required, validated as base58 pubkey)
- **Mint** — Solana address input (required, validated as base58 pubkey)
- **Amount** — number input (required, default `1000`)

**Data flow:**
- `ProveFlowPanel` holds `transferParams` state: `{ recipient: string; mint: string; amount: number }`.
- `useProveFlow.runFlow` accepts `transferParams` as a parameter.
- `LiveFlowContext` carries `transferParams` through the pipeline.
- `runStepProofGeneration` uses `transferParams.mint` and `transferParams.recipient` (parsed as `PublicKey`) instead of `publicKey` for `mintBytes`/`recipientBytes`.
- `runStepSubmit` uses the same values for `transferContext.mint` and `transferContext.recipient`, and `transferParams.amount` for `transferContext.amount`.

**Validation:** On submit, validate that both addresses are valid base58 Solana public keys. Show inline error if invalid.

## Files changed

| File | Change |
|------|--------|
| `sdk/src/wrap/index.ts` | Add `buildRegisterIssuerIx`, `checkIssuerExists` |
| `sdk/src/index.ts` | Export new functions |
| `frontend/src/hooks/use-prove-flow.ts` | Add issuer check + auto-register; accept `transferParams`; use them in proof gen and submit |
| `frontend/src/components/dashboard/prove-flow-panel.tsx` | Add form inputs to IntroCard; pass `transferParams` to `runFlow` |

## Out of scope

- Persisting transfer params across sessions
- Token account creation for recipient
- Querying available mints from chain
