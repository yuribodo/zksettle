"use client";

import { useCallback, useReducer, useRef, type Dispatch } from "react";
import { TransactionExpiredBlockheightExceededError } from "@solana/web3.js";
import type { Connection, PublicKey, Transaction } from "@solana/web3.js";

import { useWallet, useConnection } from "@/hooks/use-wallet-connection";
import { useProofGeneration } from "@/hooks/use-proof-generation";
import { useZkPrivateKey } from "@/hooks/use-zk-private-key";
import {
  getCredential,
  getJurisdictionProof,
  getMembershipProof,
  getSanctionsProof,
  getRoots,
} from "@/lib/api/endpoints";
import { bytesToHex } from "@/lib/wallet";
import { computeNullifier } from "@/lib/nullifier";
import { PROOF_FIXTURE } from "@/lib/proof-fixture";
import {
  flowReducer,
  INITIAL_STATE,
  assembleProofInputs,
  type FlowState,
  type FlowAction,
} from "@/lib/prove-flow";
import type { ProofInputs, ProofResult } from "@/types/proof";

export interface TransferParams {
  mint: string;
  recipient: string;
  amount: number;
}

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

const CREDENTIAL_VALIDITY_SECS = 365 * 24 * 3600;

function formatProofPreview(proof: Uint8Array): string {
  return Array.from(proof.slice(0, 32))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Step runners (extracted to reduce cognitive complexity) ──────────

async function runDemoFlow(
  dispatch: Dispatch<FlowAction>,
  generate: (inputs: ProofInputs) => Promise<ProofResult>,
): Promise<void> {
  dispatch({ type: "STEP_RUNNING", step: 1 });
  dispatch({ type: "STEP_SUCCESS", step: 1, data: { demo: true } });

  dispatch({ type: "STEP_RUNNING", step: 2 });
  dispatch({ type: "STEP_SUCCESS", step: 2, data: { demo: true } });

  dispatch({ type: "STEP_RUNNING", step: 3 });
  const result = await generate(PROOF_FIXTURE);
  dispatch({
    type: "STEP_SUCCESS",
    step: 3,
    data: {
      proof: result.proof,
      publicInputs: result.publicInputs,
      proofPreview: formatProofPreview(result.proof),
      publicInputCount: result.publicInputs.length,
    },
    durationMs: result.durationMs,
  });

  dispatch({ type: "STEP_RUNNING", step: 4 });
  dispatch({ type: "STEP_SUCCESS", step: 4, data: { skipped: true } });

  dispatch({ type: "STEP_RUNNING", step: 5 });
  dispatch({ type: "STEP_SUCCESS", step: 5, data: { demo: true } });
}

async function runStepCredential(
  dispatch: Dispatch<FlowAction>,
  walletHex: string,
) {
  dispatch({ type: "STEP_RUNNING", step: 1 });
  const start = performance.now();
  const credential = await getCredential(walletHex);
  if (credential.revoked) throw new Error("Credential has been revoked.");
  const expiresAt = credential.issued_at + CREDENTIAL_VALIDITY_SECS;
  if (Math.floor(Date.now() / 1000) >= expiresAt) {
    throw new Error("Credential has expired. Re-issue from the Wallets & Credentials page.");
  }
  dispatch({
    type: "STEP_SUCCESS",
    step: 1,
    data: { jurisdiction: credential.jurisdiction },
    durationMs: performance.now() - start,
  });
  return credential;
}

async function runStepMerklePaths(
  dispatch: Dispatch<FlowAction>,
  walletHex: string,
  derivePrivateKey: () => Promise<string>,
) {
  dispatch({ type: "STEP_RUNNING", step: 2 });
  const start = performance.now();
  const [membership, sanctions, roots, jurisdictionProof, zkPrivateKey] =
    await Promise.all([
      getMembershipProof(walletHex),
      getSanctionsProof(walletHex),
      getRoots(),
      getJurisdictionProof(walletHex),
      derivePrivateKey(),
    ]);
  dispatch({
    type: "STEP_SUCCESS",
    step: 2,
    data: { root: roots.membership_root.slice(0, 16) },
    durationMs: performance.now() - start,
  });
  return { membership, sanctions, roots, jurisdictionProof, zkPrivateKey };
}

async function runStepProofGeneration(
  dispatch: Dispatch<FlowAction>,
  publicKey: PublicKey,
  credential: { issued_at: number; wallet: number[]; leaf_index: number; jurisdiction: string; revoked: boolean },
  paths: Awaited<ReturnType<typeof runStepMerklePaths>>,
  generate: (inputs: ProofInputs) => Promise<ProofResult>,
  transferParams: TransferParams,
) {
  dispatch({ type: "STEP_RUNNING", step: 3 });
  const { membership, sanctions, roots, jurisdictionProof, zkPrivateKey } = paths;
  const { PublicKey: SolPublicKey } = await import("@solana/web3.js");
  const mintPubkey = new SolPublicKey(transferParams.mint);
  const recipientPubkey = new SolPublicKey(transferParams.recipient);
  const mintBytes = mintPubkey.toBytes();
  const recipientBytes = recipientPubkey.toBytes();
  // Limb split must match on-chain `pubkey_to_limbs`
  // (programs/zksettle/src/instructions/verify_proof/helpers.rs:32): the LOW
  // limb carries the *trailing* 16 bytes of the pubkey, the HIGH limb the
  // *leading* 16. Swapping these silently passes the circuit (which just
  // hashes whatever it gets) but trips `check_bindings`' `MintMismatch` /
  // `RecipientMismatch` on `settle_hook`, since the on-chain re-derive uses
  // the canonical order against the witness positions.
  const mintLo = toHex(mintBytes.slice(16, 32));
  const mintHi = toHex(mintBytes.slice(0, 16));
  const recipientLo = toHex(recipientBytes.slice(16, 32));
  const recipientHi = toHex(recipientBytes.slice(0, 16));
  const epoch = String(Math.floor(Date.now() / 1000 / 86400));
  const amount = String(transferParams.amount);
  const timestamp = String(Number(epoch) * 86_400);
  const credentialExpiry = String(credential.issued_at + CREDENTIAL_VALIDITY_SECS);

  const nullifier = await computeNullifier({
    privateKey: zkPrivateKey,
    mintLo,
    mintHi,
    epoch,
    recipientLo,
    recipientHi,
    amount,
  });

  const inputs = assembleProofInputs(credential, membership, sanctions, roots, {
    nullifier,
    mintLo,
    mintHi,
    recipientLo,
    recipientHi,
    amount,
    epoch,
    privateKey: zkPrivateKey,
    credentialExpiry,
    jurisdictionPath: jurisdictionProof.path,
    jurisdictionPathIndices: jurisdictionProof.path_indices,
    timestamp,
  });

  const proofResult = await generate(inputs);
  dispatch({
    type: "STEP_SUCCESS",
    step: 3,
    data: {
      proof: proofResult.proof,
      publicInputs: proofResult.publicInputs,
      proofPreview: formatProofPreview(proofResult.proof),
      proofBytes: proofResult.proof.length,
      publicInputCount: proofResult.publicInputs.length,
    },
    durationMs: proofResult.durationMs,
  });
  return { proofResult, zkPrivateKey, credentialExpiry, jurisdictionProof };
}

async function runStepSubmit(
  dispatch: Dispatch<FlowAction>,
  proofResult: ProofResult,
  publicKey: PublicKey,
  connection: Connection,
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>,
  submitCtx: {
    zkPrivateKey: string;
    credentialExpiry: string;
    jurisdictionProof: { path: string[]; path_indices: number[] };
    roots: import("@/lib/api/schemas").Roots;
  },
  transferParams: TransferParams,
): Promise<string | undefined> {
  dispatch({ type: "STEP_RUNNING", step: 4 });

  const start = performance.now();
  const [sdk, { BN }, { PublicKey: SolPublicKey, Transaction, ComputeBudgetProgram }] = await Promise.all([
    import("@zksettle/sdk"),
    import("@coral-xyz/anchor"),
    import("@solana/web3.js"),
  ]);
  const {
    checkIssuerExists, buildRegisterIssuerIx,
    checkHookPayloadExists, buildCloseHookPayloadIx,
    buildInitHookPayloadIx, buildResizeHookPayloadIx,
    buildWriteChunkIx, buildFinalizeHookPayloadIx,
    CHUNK_SIZE,
  } = sdk;

  const hexToBytes = (hex: string): Uint8Array => {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    return new Uint8Array(clean.match(/.{1,2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []);
  };

  // `confirmTransaction({signature, blockhash, lastValidBlockHeight})` ties
  // the wait-loop expiry to the SAME blockhash the tx was signed with.
  // Fetching a fresh blockhash here decouples the timeout from actual tx
  // expiry and can yield false timeouts / false success (Solana docs).
  // Always pass the bh that was set on `tx.recentBlockhash` before signing.
  type Blockhash = { blockhash: string; lastValidBlockHeight: number };
  type ConfirmCommitment = "processed" | "confirmed" | "finalized";
  const CONFIRM_FALLBACK_TIMEOUT_MS = 30_000;
  const CONFIRM_FALLBACK_INITIAL_DELAY_MS = 1_000;
  const CONFIRM_FALLBACK_MAX_DELAY_MS = 4_000;
  // Intermediate batches (init/resize/writes/finalize) use "processed" to skip
  // the ~5-15s confirmed-commitment wait. The next batch fetches a fresh
  // "confirmed" blockhash before signing, so account-state visibility is still
  // covered for the leader. Settle stays at "confirmed" — it's the final tx
  // and the indexer keys off ProofSettled landing in a confirmed block.
  const confirmTx = async (
    sig: string,
    bh: Blockhash,
    commitment: ConfirmCommitment = "confirmed",
  ) => {
    try {
      await connection.confirmTransaction(
        { signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
        commitment,
      );
    } catch (err) {
      // Narrow: only fall back on the strategy's edge-window expiry.
      // Other errors (RPC/network/SendTransactionError) re-throw immediately
      // so we don't burn 30s polling on a failure that won't resolve.
      if (!(err instanceof TransactionExpiredBlockheightExceededError)) throw err;
      // BlockheightBasedTransactionConfirmationStrategy returns the moment
      // current height passes lastValidBlockHeight, even if the tx lands at
      // the edge of the validity window. Poll getSignatureStatus directly
      // so a late inclusion isn't surfaced as a false-negative expiry.
      const deadline = Date.now() + CONFIRM_FALLBACK_TIMEOUT_MS;
      let delay = CONFIRM_FALLBACK_INITIAL_DELAY_MS;
      while (Date.now() < deadline) {
        const { value } = await connection.getSignatureStatus(sig, {
          searchTransactionHistory: true,
        });
        const reached =
          commitment === "processed"
            ? value?.confirmationStatus === "processed" ||
              value?.confirmationStatus === "confirmed" ||
              value?.confirmationStatus === "finalized"
            : value?.confirmationStatus === "confirmed" ||
              value?.confirmationStatus === "finalized";
        if (reached) {
          if (value?.err) {
            throw new Error("tx landed but failed on chain", { cause: value.err });
          }
          return;
        }
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, CONFIRM_FALLBACK_MAX_DELAY_MS);
      }
      throw err;
    }
  };

  type SendOpts = { skipPreflight?: boolean; maxRetries?: number };
  const sendSigned = async (
    signed: Transaction,
    bh: Blockhash,
    commitment: ConfirmCommitment = "confirmed",
    sendOpts: SendOpts = {},
  ) => {
    const sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: sendOpts.skipPreflight ?? true,
      maxRetries: sendOpts.maxRetries ?? 3,
    });
    await confirmTx(sig, bh, commitment);
    return sig;
  };

  // ── Pre-requisites (issuer registration, stale cleanup) ──
  // These need separate signing since they must complete before the proof upload.
  const issuerExists = await checkIssuerExists(publicKey, connection);
  if (!issuerExists) {
    const roots = submitCtx.roots;
    const ix = await buildRegisterIssuerIx(publicKey, {
      merkleRoot: hexToBytes(roots.membership_root),
      sanctionsRoot: hexToBytes(roots.sanctions_root),
      jurisdictionRoot: hexToBytes(roots.jurisdiction_root),
    }, connection);
    const tx = new Transaction().add(ix);
    tx.feePayer = publicKey;
    const bhRegister = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = bhRegister.blockhash;
    const [signed] = await signAllTransactions([tx]);
    await sendSigned(signed!, bhRegister, "processed");
  }

  const stalePayload = await checkHookPayloadExists(publicKey, connection);
  if (stalePayload) {
    const ix = await buildCloseHookPayloadIx(publicKey, connection);
    const tx = new Transaction().add(ix);
    tx.feePayer = publicKey;
    const bhClose = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = bhClose.blockhash;
    const [signed] = await signAllTransactions([tx]);
    await sendSigned(signed!, bhClose, "processed");
  }

  // ── Build ALL proof upload transactions upfront ──
  const proofBytes = proofResult.proof;
  const nullifierBytes = hexToBytes(proofResult.publicInputs[1] ?? "");
  const mintPubkey = new SolPublicKey(transferParams.mint);
  const recipientPubkey = new SolPublicKey(transferParams.recipient);
  const chunkSize = CHUNK_SIZE;
  const writesPerTx = 2;

  const initIx = await buildInitHookPayloadIx(publicKey, proofBytes.length, connection);

  // Solana caps realloc at 10 KiB per instruction. Pre-count resize ixs so
  // they batch into one Phantom popup with init. Upper-bound the count from
  // proof size alone so we never under-allocate (extra resizes are idempotent
  // no-ops on-chain). Avoids hardcoding HookPayload::BASE_SPACE on the client.
  const resizeCount = Math.ceil(proofBytes.length / 10_240);
  const resizeIxs = [];
  for (let i = 0; i < resizeCount; i++) {
    resizeIxs.push(await buildResizeHookPayloadIx(publicKey, connection));
  }

  const writeIxs = [];
  for (let offset = 0; offset < proofBytes.length; offset += chunkSize) {
    const chunk = proofBytes.slice(offset, Math.min(offset + chunkSize, proofBytes.length));
    writeIxs.push(await buildWriteChunkIx(publicKey, offset, chunk, connection));
  }

  const epoch = Math.floor(Date.now() / 1000 / 86400);
  const finalizeIx = await buildFinalizeHookPayloadIx(publicKey, {
    nullifierHash: nullifierBytes,
    mint: mintPubkey,
    epoch,
    recipient: recipientPubkey,
    amount: new BN(transferParams.amount),
  }, connection);

  // ── Batch 1: init + resize (own blockhash + Phantom popup) ──
  const initResizeTxs: Transaction[] = [];
  const initTx = new Transaction().add(initIx);
  if (resizeIxs.length > 0) initTx.add(resizeIxs[0]!);
  initResizeTxs.push(initTx);
  for (let i = 1; i < resizeIxs.length; i++) {
    initResizeTxs.push(new Transaction().add(resizeIxs[i]!));
  }

  const bh1 = await connection.getLatestBlockhash("confirmed");
  for (const tx of initResizeTxs) {
    tx.feePayer = publicKey;
    tx.recentBlockhash = bh1.blockhash;
  }
  const signedInitResize = await signAllTransactions(initResizeTxs);
  for (const tx of signedInitResize) {
    await sendSigned(tx, bh1, "processed");
  }

  // ── Batch 2: writes only (fresh blockhash + Phantom popup) ──
  const writeTxs: Transaction[] = [];
  for (let i = 0; i < writeIxs.length; i += writesPerTx) {
    const tx = new Transaction();
    for (const ix of writeIxs.slice(i, i + writesPerTx)) tx.add(ix);
    writeTxs.push(tx);
  }

  const bh2 = await connection.getLatestBlockhash("confirmed");
  for (const tx of writeTxs) {
    tx.feePayer = publicKey;
    tx.recentBlockhash = bh2.blockhash;
  }
  const signedWrites = await signAllTransactions(writeTxs);

  // Send writes sequentially — the on-chain handler enforces that each
  // chunk offset matches high_water_mark, so ordering must be preserved.
  let lastWriteSig = "";
  for (const tx of signedWrites) {
    lastWriteSig = await connection.sendRawTransaction(tx!.serialize(), {
      skipPreflight: true,
      maxRetries: 5,
    });
  }

  // Confirming the last write guarantees all prior writes landed (each
  // write's offset must match the cumulative high_water_mark).
  if (lastWriteSig) await confirmTx(lastWriteSig, bh2, "processed");

  // ── Batch 3: finalize (own fresh blockhash + Phantom popup) ──
  // Finalize is the final on-chain tx in this flow (settle_hook integration
  // pending Light CPI wiring). Attach a priority fee + bump maxRetries so the
  // tx survives Alchemy devnet congestion: w/o a fee, leaders skip the tx and
  // the blockhash window (60-90s) expires before inclusion, surfacing as
  // `TransactionExpiredBlockheightExceededError`. 50k µLamports/CU × default
  // 200K CU ≈ 10,000 lamports ≈ 0.00001 SOL — negligible vs rent already paid.
  const finalizeCuPriceIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 });
  const finalizeTx = new Transaction().add(finalizeCuPriceIx).add(finalizeIx);
  const bh3 = await connection.getLatestBlockhash("confirmed");
  finalizeTx.feePayer = publicKey;
  finalizeTx.recentBlockhash = bh3.blockhash;
  const [signedFinalize] = await signAllTransactions([finalizeTx]);
  const finalSig = await sendSigned(signedFinalize!, bh3, "confirmed", {
    maxRetries: 10,
  });

  dispatch({ type: "SET_TX", signature: finalSig });
  dispatch({
    type: "STEP_SUCCESS",
    step: 4,
    data: { signature: finalSig },
    durationMs: performance.now() - start,
  });
  return finalSig;
}

async function runStepConfirm(dispatch: Dispatch<FlowAction>): Promise<void> {
  // Step 4 (`runStepSubmit`) already awaited `confirmTransaction` for the
  // finalize tx using its original signing blockhash. Re-confirming here with
  // a freshly-fetched blockhash would (a) decouple the wait-loop expiry from
  // the actual tx (Solana docs explicitly warn against this) and (b) be
  // redundant. Keep this step purely for the UI step-machine.
  dispatch({ type: "STEP_RUNNING", step: 5 });
  const start = performance.now();
  dispatch({
    type: "STEP_SUCCESS",
    step: 5,
    durationMs: performance.now() - start,
  });
}

function stepError(dispatch: Dispatch<FlowAction>, step: number, err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback;
  dispatch({ type: "STEP_ERROR", step, error: msg });
  return msg;
}

interface LiveFlowContext {
  dispatch: Dispatch<FlowAction>;
  walletHex: string;
  publicKey: PublicKey;
  connection: Connection;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
  generate: (inputs: ProofInputs) => Promise<ProofResult>;
  derivePrivateKey: () => Promise<string>;
  transferParams: TransferParams;
}

function handleCredentialError(dispatch: Dispatch<FlowAction>, err: unknown): void {
  const msg = stepError(dispatch, 1, err, "Failed to fetch credential");
  if (msg.includes("404")) {
    dispatch({ type: "STEP_ERROR", step: 1, error: "No credential found for this wallet. Issue one from the Wallets & Credentials page, or try demo mode." });
  }
}

function handleSubmitError(dispatch: Dispatch<FlowAction>, err: unknown): void {
  console.error("[zksettle] Submit step error:", err);
  try { console.error("[zksettle] Error JSON:", JSON.stringify(err, Object.getOwnPropertyNames(err as object))); } catch { /* */ }
  const errRecord = err as Record<string, unknown>;
  const inner = errRecord?.error;
  if (inner) console.error("[zksettle] Inner error:", inner);
  const logs = (errRecord?.logs ?? (inner as Record<string, unknown>)?.logs) as string[] | undefined;
  if (logs) console.error("[zksettle] Transaction logs:", logs);
  const message = err instanceof Error ? err.message : String(errRecord?.message ?? "Transaction failed");
  const isRejected = message.includes("rejected") || message.includes("User rejected");
  dispatch({ type: "STEP_ERROR", step: 4, error: isRejected ? "Transaction rejected by wallet." : message });
}

async function runLiveFlow(ctx: LiveFlowContext): Promise<void> {
  const { dispatch, walletHex, publicKey, connection, signAllTransactions, generate, derivePrivateKey, transferParams } = ctx;
  let credential;
  try { credential = await runStepCredential(dispatch, walletHex); }
  catch (err) { handleCredentialError(dispatch, err); return; }

  let paths;
  try { paths = await runStepMerklePaths(dispatch, walletHex, derivePrivateKey); }
  catch (err) { stepError(dispatch, 2, err, "Failed to fetch Merkle paths"); return; }

  let step3Result;
  try { step3Result = await runStepProofGeneration(dispatch, publicKey, credential, paths, generate, transferParams); }
  catch (err) { stepError(dispatch, 3, err, "Proof generation failed"); return; }

  let txSignature: string | undefined;
  try {
    txSignature = await runStepSubmit(dispatch, step3Result.proofResult, publicKey, connection, signAllTransactions, { ...step3Result, roots: paths.roots }, transferParams);
  } catch (err) {
    handleSubmitError(dispatch, err);
    return;
  }

  try { await runStepConfirm(dispatch); }
  catch (err) {
    if (txSignature) { stepError(dispatch, 5, err, "Confirmation failed"); }
    else { dispatch({ type: "STEP_SUCCESS", step: 5 }); }
  }
}

// ── Hook ────────────────────────────────────────────────────────────

export function useProveFlow(): UseProveFlowReturn {
  const [state, dispatch] = useReducer(flowReducer, INITIAL_STATE);
  const { connected, publicKey, signAllTransactions } = useWallet();
  const { connection } = useConnection();

  const walletHex = publicKey
    ? bytesToHex(Array.from(publicKey.toBytes()))
    : null;

  const { generate } = useProofGeneration();
  const { derivePrivateKey } = useZkPrivateKey();

  const runningRef = useRef(false);
  const isRunning = state.steps.some((s) => s.status === "running");
  const isDone = state.steps.at(-1)?.status === "success";
  const txUrl = state.txSignature
    ? `https://solscan.io/tx/${state.txSignature}?cluster=devnet`
    : null;

  const runFlow = useCallback(
    async (mode: "live" | "demo", params?: TransferParams) => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
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

      if (!signAllTransactions) {
        dispatch({ type: "STEP_ERROR", step: 1, error: "Wallet does not support batch transaction signing." });
        return;
      }

      await runLiveFlow({ dispatch, walletHex, publicKey, connection, signAllTransactions, generate, derivePrivateKey, transferParams: params });
      } finally { runningRef.current = false; }
    },
    [connected, publicKey, walletHex, connection, signAllTransactions, generate, derivePrivateKey],
  );

  const startFlow = useCallback((params: TransferParams) => runFlow("live", params), [runFlow]);
  const startDemo = useCallback(() => runFlow("demo"), [runFlow]);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, startFlow, startDemo, reset, canStart: connected && !isRunning, isRunning, isDone, txUrl };
}
