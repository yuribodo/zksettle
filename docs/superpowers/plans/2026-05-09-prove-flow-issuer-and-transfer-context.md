# Prove Flow: Issuer Registration & Transfer Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `WalletSendTransactionError` by auto-registering issuer PDA before proof upload, and replace hardcoded mint/recipient/amount with user-provided form inputs.

**Architecture:** Two layers of changes: (1) SDK gets two new browser-compatible functions (`buildRegisterIssuerIx`, `checkIssuerExists`) following the existing `buildInitHookPayloadIx` pattern. (2) Frontend gets form inputs on the IntroCard that flow through `useProveFlow` → proof generation → on-chain submission. The issuer check + auto-register happens inside `runStepSubmit` before `uploadProofChunked`.

**Tech Stack:** TypeScript, @solana/web3.js, @coral-xyz/anchor (browser build), React, Next.js, Sonner (toasts)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `sdk/src/wrap/index.ts` | Modify | Add `buildRegisterIssuerIx` and `checkIssuerExists` |
| `sdk/src/index.ts` | Modify | Export new functions |
| `frontend/src/hooks/use-prove-flow.ts` | Modify | Accept `TransferParams`, thread through proof gen + submit, add issuer auto-register |
| `frontend/src/components/dashboard/prove-flow-panel.tsx` | Modify | Add mint/recipient/amount form to IntroCard, pass to hook |

---

### Task 1: SDK — Add `buildRegisterIssuerIx` and `checkIssuerExists`

**Files:**
- Modify: `sdk/src/wrap/index.ts`
- Modify: `sdk/src/index.ts`

- [ ] **Step 1: Add `checkIssuerExists` to `sdk/src/wrap/index.ts`**

Add this function after the `WRITES_PER_TX` constant (line 48), before the `makeProgram` function:

```typescript
export async function checkIssuerExists(
  wallet: PublicKey,
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
): Promise<boolean> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const info = await connection.getAccountInfo(issuerPda);
  return info !== null;
}
```

- [ ] **Step 2: Add `buildRegisterIssuerIx` to `sdk/src/wrap/index.ts`**

Add this function right after `checkIssuerExists`:

```typescript
export async function buildRegisterIssuerIx(
  wallet: PublicKey,
  roots: { merkleRoot: Uint8Array; sanctionsRoot: Uint8Array; jurisdictionRoot: Uint8Array },
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
  program?: Program,
): Promise<TransactionInstruction> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const prog = program ?? await makeProgram(connection);

  return prog.methods
    .registerIssuer(
      Array.from(roots.merkleRoot),
      Array.from(roots.sanctionsRoot),
      Array.from(roots.jurisdictionRoot),
    )
    .accounts({
      authority: wallet,
      issuer: issuerPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}
```

- [ ] **Step 3: Export new functions from `sdk/src/index.ts`**

Change the existing `wrap/index.js` export block (lines 2-8) to include the new functions:

```typescript
export {
  buildInitHookPayloadIx,
  buildWriteChunkIx,
  buildFinalizeHookPayloadIx,
  uploadProofChunked,
  checkIssuerExists,
  buildRegisterIssuerIx,
  CHUNK_SIZE,
} from "./wrap/index.js";
```

- [ ] **Step 4: Build SDK and verify no type errors**

Run: `cd /home/mario/zksettle/sdk && pnpm build`
Expected: Clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add sdk/src/wrap/index.ts sdk/src/index.ts
git commit -m "feat(sdk): add browser-compatible buildRegisterIssuerIx and checkIssuerExists"
```

---

### Task 2: Frontend — Accept transfer params in `useProveFlow`

**Files:**
- Modify: `frontend/src/hooks/use-prove-flow.ts`

- [ ] **Step 1: Add `TransferParams` type and update `UseProveFlowReturn`**

At the top of `use-prove-flow.ts`, after the existing imports (line 26), add:

```typescript
export interface TransferParams {
  mint: string;
  recipient: string;
  amount: number;
}
```

Update `UseProveFlowReturn` (lines 28-37) to change `startFlow` signature:

```typescript
export interface UseProveFlowReturn {
  state: FlowState;
  startFlow: (params: TransferParams) => Promise<void>;
  startDemo: () => Promise<void>;
  reset: () => void;
  canStart: boolean;
  isRunning: boolean;
  isDone: boolean;
  txUrl: string | null;
}
```

- [ ] **Step 2: Add `TransferParams` to `LiveFlowContext` and `runStepProofGeneration`**

Update `LiveFlowContext` (around line 271) to include transfer params:

```typescript
interface LiveFlowContext {
  dispatch: Dispatch<FlowAction>;
  walletHex: string;
  publicKey: PublicKey;
  connection: Connection;
  sendTransaction: (tx: Transaction, conn: Connection) => Promise<string>;
  generate: (inputs: ProofInputs) => Promise<ProofResult>;
  ensureApi: () => Promise<import("@aztec/bb.js").Barretenberg>;
  derivePrivateKey: () => Promise<string>;
  transferParams: TransferParams;
}
```

Update `runStepProofGeneration` signature to accept `transferParams` instead of using `publicKey` for mint/recipient. Change the function signature (line 129) to:

```typescript
async function runStepProofGeneration(
  dispatch: Dispatch<FlowAction>,
  publicKey: PublicKey,
  credential: { issued_at: number; wallet: number[]; leaf_index: number; jurisdiction: string; revoked: boolean },
  paths: Awaited<ReturnType<typeof runStepMerklePaths>>,
  ensureApi: () => Promise<import("@aztec/bb.js").Barretenberg>,
  generate: (inputs: ProofInputs) => Promise<ProofResult>,
  transferParams: TransferParams,
) {
```

Replace lines 138-146 (the mint/recipient/amount setup) with:

```typescript
  dispatch({ type: "STEP_RUNNING", step: 3 });
  const { membership, sanctions, roots, jurisdictionProof, zkPrivateKey } = paths;
  const { PublicKey: SolPublicKey } = await import("@solana/web3.js");
  const mintPubkey = new SolPublicKey(transferParams.mint);
  const recipientPubkey = new SolPublicKey(transferParams.recipient);
  const mintBytes = mintPubkey.toBytes();
  const recipientBytes = recipientPubkey.toBytes();
  const mintLo = toHex(mintBytes.slice(0, 16));
  const mintHi = toHex(mintBytes.slice(16, 32));
  const recipientLo = toHex(recipientBytes.slice(0, 16));
  const recipientHi = toHex(recipientBytes.slice(16, 32));
  const epoch = String(Math.floor(Date.now() / 1000 / 86400));
  const amount = String(transferParams.amount);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const credentialExpiry = String(credential.issued_at + CREDENTIAL_VALIDITY_SECS);
```

- [ ] **Step 3: Update `runStepSubmit` to accept transfer params and auto-register issuer**

Update `runStepSubmit` signature to include `transferParams` and `roots`:

```typescript
async function runStepSubmit(
  dispatch: Dispatch<FlowAction>,
  proofResult: ProofResult,
  publicKey: PublicKey,
  connection: Connection,
  sendTransaction: (tx: Transaction, conn: Connection) => Promise<string>,
  submitCtx: {
    zkPrivateKey: string;
    credentialExpiry: string;
    jurisdictionProof: { path: string[]; path_indices: number[] };
    roots: import("@/lib/api/schemas").Roots;
  },
  transferParams: TransferParams,
): Promise<string | undefined> {
```

Replace the body (lines 200-244) with:

```typescript
  dispatch({ type: "STEP_RUNNING", step: 4 });

  const start = performance.now();
  const [{ uploadProofChunked, checkIssuerExists, buildRegisterIssuerIx }, { BN }, { PublicKey: SolPublicKey, Transaction }] = await Promise.all([
    import("@zksettle/sdk"),
    import("@coral-xyz/anchor"),
    import("@solana/web3.js"),
  ]);

  const hexToBytes = (hex: string): Uint8Array => {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    return new Uint8Array(clean.match(/.{1,2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []);
  };

  const issuerExists = await checkIssuerExists(publicKey, connection);
  if (!issuerExists) {
    const roots = submitCtx.roots;
    const ix = await buildRegisterIssuerIx(
      publicKey,
      {
        merkleRoot: hexToBytes(roots.membership_root),
        sanctionsRoot: hexToBytes(roots.sanctions_root),
        jurisdictionRoot: hexToBytes(roots.jurisdiction_root),
      },
      connection,
    );
    await sendTransaction(new Transaction().add(ix), connection);
  }

  const nullifierHex = proofResult.publicInputs[1] ?? "";
  const nullifierBytes = hexToBytes(nullifierHex);

  const mintPubkey = new SolPublicKey(transferParams.mint);
  const recipientPubkey = new SolPublicKey(transferParams.recipient);

  const result = await uploadProofChunked(
    {
      connection,
      wallet: publicKey,
      proof: proofResult.proof,
      nullifierHash: nullifierBytes,
      transferContext: {
        mint: mintPubkey,
        recipient: recipientPubkey,
        amount: new BN(transferParams.amount),
        epoch: Math.floor(Date.now() / 1000 / 86400),
        privateKey: submitCtx.zkPrivateKey,
        credentialExpiry: submitCtx.credentialExpiry,
        jurisdictionPath: submitCtx.jurisdictionProof.path.map((h) =>
          h.startsWith("0x") ? h : `0x${h}`,
        ),
        jurisdictionPathIndices: submitCtx.jurisdictionProof.path_indices,
      },
    },
    (tx) => sendTransaction(tx, connection),
  );

  const signature = result.finalizeSignature;
  dispatch({ type: "SET_TX", signature });
  dispatch({
    type: "STEP_SUCCESS",
    step: 4,
    data: { signature },
    durationMs: performance.now() - start,
  });
  return signature;
```

- [ ] **Step 4: Update `runLiveFlow` to thread `transferParams`**

Update the `runLiveFlow` function (starting at line 282) to destructure and pass `transferParams`:

```typescript
async function runLiveFlow(ctx: LiveFlowContext): Promise<void> {
  const { dispatch, walletHex, publicKey, connection, sendTransaction, generate, ensureApi, derivePrivateKey, transferParams } = ctx;
```

Update the `runStepProofGeneration` call (around line 299) to pass `transferParams`:

```typescript
  try { step3Result = await runStepProofGeneration(dispatch, publicKey, credential, paths, ensureApi, generate, transferParams); }
```

Update the `runStepSubmit` call (around line 304) to pass `transferParams` and include `roots` in the context:

```typescript
  try {
    txSignature = await runStepSubmit(dispatch, step3Result.proofResult, publicKey, connection, sendTransaction, { ...step3Result, roots: paths.roots }, transferParams);
  }
```

- [ ] **Step 5: Update the `useProveFlow` hook to accept and forward `TransferParams`**

Update `runFlow` (around line 339) to accept `TransferParams`:

```typescript
  const runFlow = useCallback(
    async (mode: "live" | "demo", params?: TransferParams) => {
      dispatch({ type: "START_FLOW", mode });

      dispatch({ type: "STEP_RUNNING", step: 0 });
      if (!connected || !publicKey) {
        dispatch({ type: "STEP_ERROR", step: 0, error: "Wallet not connected. Please connect your wallet first." });
        return;
      }
      dispatch({ type: "STEP_SUCCESS", step: 0 });

      if (mode === "demo") {
        try { await runDemoFlow(dispatch, generate); }
        catch (err) { stepError(dispatch, 3, err, "Proof generation failed"); }
        return;
      }

      if (!walletHex || !params) {
        dispatch({ type: "STEP_ERROR", step: 1, error: "Wallet not resolved." });
        return;
      }

      await runLiveFlow({ dispatch, walletHex, publicKey, connection, sendTransaction, generate, ensureApi, derivePrivateKey, transferParams: params });
    },
    [connected, publicKey, walletHex, connection, sendTransaction, generate, ensureApi, derivePrivateKey],
  );

  const startFlow = useCallback((params: TransferParams) => runFlow("live", params), [runFlow]);
```

- [ ] **Step 6: Verify frontend types compile**

Run: `cd /home/mario/zksettle/frontend && pnpm typecheck`
Expected: No errors (may have errors in prove-flow-panel.tsx since we changed the `startFlow` signature — that's fixed in Task 3).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/use-prove-flow.ts
git commit -m "feat(frontend): thread transfer params through prove flow and auto-register issuer"
```

---

### Task 3: Frontend — Add form inputs to IntroCard

**Files:**
- Modify: `frontend/src/components/dashboard/prove-flow-panel.tsx`

- [ ] **Step 1: Add state and validation to `ProveFlowPanel`**

Import `TransferParams` from the hook and add state management. In `ProveFlowPanel` (line 358), add state before the existing `hasStarted` variable:

```typescript
import { useProveFlow, type TransferParams } from "@/hooks/use-prove-flow";
```

Inside `ProveFlowPanel`, add state:

```typescript
  const [transferParams, setTransferParams] = useState<TransferParams>({
    mint: "",
    recipient: "",
    amount: 1000,
  });
  const [formError, setFormError] = useState<string | null>(null);
```

Add a `PublicKey` import at the top of the file for validation:

```typescript
import { PublicKey as SolPublicKey } from "@solana/web3.js";
```

Add a validation + start handler inside `ProveFlowPanel`:

```typescript
  const handleStart = useCallback(() => {
    if (!transferParams.mint.trim() || !transferParams.recipient.trim()) {
      setFormError("Mint and recipient addresses are required.");
      return;
    }
    try { new SolPublicKey(transferParams.mint); } catch {
      setFormError("Invalid mint address.");
      return;
    }
    try { new SolPublicKey(transferParams.recipient); } catch {
      setFormError("Invalid recipient address.");
      return;
    }
    if (transferParams.amount <= 0) {
      setFormError("Amount must be greater than zero.");
      return;
    }
    setFormError(null);
    startFlow(transferParams);
  }, [transferParams, startFlow]);
```

Update the IntroCard render to pass `handleStart`:

```tsx
<IntroCard
  key="intro"
  connected={connected}
  canStart={canStart}
  onStart={handleStart}
  onDemo={startDemo}
  transferParams={transferParams}
  onTransferParamsChange={setTransferParams}
  formError={formError}
/>
```

- [ ] **Step 2: Update `IntroCard` props and add form fields**

Update the `IntroCard` component props and body. Replace the entire `IntroCard` function (lines 159-221) with:

```tsx
function IntroCard({
  connected,
  canStart,
  onStart,
  onDemo,
  transferParams,
  onTransferParamsChange,
  formError,
}: Readonly<{
  connected: boolean;
  canStart: boolean;
  onStart: () => void;
  onDemo: () => void;
  transferParams: TransferParams;
  onTransferParamsChange: (params: TransferParams) => void;
  formError: string | null;
}>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
      className="rounded-[var(--radius-6)] border border-forest/20 bg-surface p-6"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-lg">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-forest" strokeWidth={1.5} aria-hidden="true" />
              <h2 className="text-sm font-medium text-ink">
                End-to-end compliance proof
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-stone">
              This page generates a zero-knowledge proof that your wallet holds a valid issuer
              credential, is not on the sanctions list, and belongs to a permitted jurisdiction
              — then submits it on-chain for verification. The entire flow runs in your browser.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="default">Noir circuit</Badge>
              <Badge variant="default">Barretenberg WASM</Badge>
              <Badge variant="default">Solana devnet</Badge>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            {!connected && (
              <>
                <ConnectWalletButton />
                <p className="text-center text-[11px] text-muted">
                  Connect a wallet to begin
                </p>
              </>
            )}
          </div>
        </div>

        {connected && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">Mint address</span>
                <input
                  type="text"
                  placeholder="Token mint public key"
                  value={transferParams.mint}
                  onChange={(e) => onTransferParamsChange({ ...transferParams, mint: e.target.value })}
                  className="h-9 w-full rounded-[var(--radius-2)] border border-border-subtle bg-canvas px-3 font-mono text-xs text-ink placeholder:text-muted transition-colors hover:border-border focus-visible:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">Recipient address</span>
                <input
                  type="text"
                  placeholder="Destination wallet public key"
                  value={transferParams.recipient}
                  onChange={(e) => onTransferParamsChange({ ...transferParams, recipient: e.target.value })}
                  className="h-9 w-full rounded-[var(--radius-2)] border border-border-subtle bg-canvas px-3 font-mono text-xs text-ink placeholder:text-muted transition-colors hover:border-border focus-visible:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 sm:max-w-[calc(50%-0.375rem)]">
              <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">Amount</span>
              <input
                type="number"
                min={1}
                value={transferParams.amount}
                onChange={(e) => onTransferParamsChange({ ...transferParams, amount: Number(e.target.value) || 0 })}
                className="h-9 w-full rounded-[var(--radius-2)] border border-border-subtle bg-canvas px-3 font-mono text-xs text-ink placeholder:text-muted transition-colors hover:border-border focus-visible:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              />
            </label>

            {formError && (
              <p className="text-xs text-red-500">{formError}</p>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={onStart} disabled={!canStart}>
                <Flash className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Start proof flow
              </Button>
              <Button variant="ghost" size="sm" onClick={onDemo}>
                <Sparks className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Run demo
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.section>
  );
}
```

- [ ] **Step 3: Add necessary imports**

Add `useState` and `useCallback` to the React import at the top (line 3):

```typescript
import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
```

Add `PublicKey` import (if not already added in Step 1):

```typescript
import { PublicKey as SolPublicKey } from "@solana/web3.js";
```

- [ ] **Step 4: Build and verify**

Run: `cd /home/mario/zksettle/frontend && pnpm typecheck`
Expected: No type errors.

- [ ] **Step 5: Visually test in browser**

1. Open `http://localhost:3001/dashboard/prove`
2. Verify the IntroCard shows mint, recipient, and amount fields when wallet is connected
3. Verify clicking "Start proof flow" with empty fields shows a validation error
4. Verify clicking "Run demo" still works without filling in the fields
5. Verify entering invalid base58 strings shows "Invalid mint/recipient address"

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/dashboard/prove-flow-panel.tsx
git commit -m "feat(frontend): add mint, recipient, and amount inputs to prove flow IntroCard"
```
