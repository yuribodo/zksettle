"use client";

import { useCallback, useReducer, type Dispatch } from "react";
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

export interface UseProveFlowReturn {
  state: FlowState;
  startFlow: () => Promise<void>;
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
  ensureApi: () => Promise<import("@aztec/bb.js").Barretenberg>,
  generate: (inputs: ProofInputs) => Promise<ProofResult>,
) {
  dispatch({ type: "STEP_RUNNING", step: 3 });
  const { membership, sanctions, roots, jurisdictionProof, zkPrivateKey } = paths;
  const mintBytes = publicKey.toBytes();
  const recipientBytes = publicKey.toBytes();
  const mintLo = toHex(mintBytes.slice(0, 16));
  const mintHi = toHex(mintBytes.slice(16, 32));
  const recipientLo = toHex(recipientBytes.slice(0, 16));
  const recipientHi = toHex(recipientBytes.slice(16, 32));
  const epoch = String(Math.floor(Date.now() / 1000 / 86400));
  const amount = "1000";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const credentialExpiry = String(credential.issued_at + CREDENTIAL_VALIDITY_SECS);

  const api = await ensureApi();
  const nullifier = await computeNullifier(api, {
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
  sendTransaction: (tx: Transaction, conn: Connection) => Promise<string>,
  submitCtx: { zkPrivateKey: string; credentialExpiry: string; jurisdictionProof: { path: string[]; path_indices: number[] } },
): Promise<string | undefined> {
  dispatch({ type: "STEP_RUNNING", step: 4 });

  const MAX_SOLANA_IX_BYTES = 740;
  if (proofResult.proof.length > MAX_SOLANA_IX_BYTES) {
    dispatch({
      type: "STEP_SUCCESS",
      step: 4,
      data: {
        skipped: true,
        reason: `Proof is ${proofResult.proof.length} bytes — exceeds Solana transaction limit. On-chain submission requires proof compression (future work).`,
      },
    });
    return undefined;
  }

  const start = performance.now();
  const [{ wrap }, { BN }] = await Promise.all([
    import("@zksettle/sdk/wrap"),
    import("@coral-xyz/anchor"),
  ]);

  const nullifierHex = proofResult.publicInputs[1] ?? "";
  const cleanHex = nullifierHex.startsWith("0x") ? nullifierHex.slice(2) : nullifierHex;
  const nullifierBytes = new Uint8Array(
    cleanHex.match(/.{1,2}/g)?.map((b) => Number.parseInt(b, 16)) ?? [],
  );

  const tx = await wrap({
    connection,
    wallet: publicKey,
    proof: proofResult.proof,
    nullifierHash: nullifierBytes,
    transferContext: {
      mint: publicKey,
      recipient: publicKey,
      amount: new BN(1000),
      epoch: Math.floor(Date.now() / 1000 / 86400),
      privateKey: submitCtx.zkPrivateKey,
      credentialExpiry: submitCtx.credentialExpiry,
      jurisdictionPath: submitCtx.jurisdictionProof.path.map((h) =>
        h.startsWith("0x") ? h : `0x${h}`,
      ),
      jurisdictionPathIndices: submitCtx.jurisdictionProof.path_indices,
    },
  });

  const signature = await sendTransaction(tx, connection);
  dispatch({ type: "SET_TX", signature });
  dispatch({
    type: "STEP_SUCCESS",
    step: 4,
    data: { signature },
    durationMs: performance.now() - start,
  });
  return signature;
}

async function runStepConfirm(
  dispatch: Dispatch<FlowAction>,
  connection: Connection,
  txSignature: string | undefined,
): Promise<void> {
  dispatch({ type: "STEP_RUNNING", step: 5 });
  const start = performance.now();
  if (txSignature) {
    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({ signature: txSignature, ...latestBlockhash }, "confirmed");
  }
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

async function runLiveFlow(
  dispatch: Dispatch<FlowAction>,
  walletHex: string,
  publicKey: PublicKey,
  connection: Connection,
  sendTransaction: (tx: Transaction, conn: Connection) => Promise<string>,
  generate: (inputs: ProofInputs) => Promise<ProofResult>,
  ensureApi: () => Promise<import("@aztec/bb.js").Barretenberg>,
  derivePrivateKey: () => Promise<string>,
): Promise<void> {
  let credential;
  try { credential = await runStepCredential(dispatch, walletHex); }
  catch (err) {
    const msg = stepError(dispatch, 1, err, "Failed to fetch credential");
    if (msg.includes("404")) {
      dispatch({ type: "STEP_ERROR", step: 1, error: "No credential found for this wallet. Issue one from the Wallets & Credentials page, or try demo mode." });
    }
    return;
  }

  let paths;
  try { paths = await runStepMerklePaths(dispatch, walletHex, derivePrivateKey); }
  catch (err) { stepError(dispatch, 2, err, "Failed to fetch Merkle paths"); return; }

  let step3Result;
  try { step3Result = await runStepProofGeneration(dispatch, publicKey, credential, paths, ensureApi, generate); }
  catch (err) { stepError(dispatch, 3, err, "Proof generation failed"); return; }

  let txSignature: string | undefined;
  try {
    txSignature = await runStepSubmit(dispatch, step3Result.proofResult, publicKey, connection, sendTransaction, step3Result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    const isRejected = message.includes("rejected") || message.includes("User rejected");
    dispatch({ type: "STEP_ERROR", step: 4, error: isRejected ? "Transaction rejected by wallet." : message });
    return;
  }

  try { await runStepConfirm(dispatch, connection, txSignature); }
  catch (err) {
    if (txSignature) { stepError(dispatch, 5, err, "Confirmation failed"); }
    else { dispatch({ type: "STEP_SUCCESS", step: 5 }); }
  }
}

// ── Hook ────────────────────────────────────────────────────────────

export function useProveFlow(): UseProveFlowReturn {
  const [state, dispatch] = useReducer(flowReducer, INITIAL_STATE);
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const walletHex = publicKey
    ? bytesToHex(Array.from(publicKey.toBytes()))
    : null;

  const { generate, ensureApi } = useProofGeneration();
  const { derivePrivateKey } = useZkPrivateKey();

  const isRunning = state.steps.some((s) => s.status === "running");
  const isDone = state.steps.at(-1)?.status === "success";
  const txUrl = state.txSignature
    ? `https://solscan.io/tx/${state.txSignature}?cluster=devnet`
    : null;

  const runFlow = useCallback(
    async (mode: "live" | "demo") => {
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

      if (!walletHex) {
        dispatch({ type: "STEP_ERROR", step: 1, error: "Wallet not resolved." });
        return;
      }

      await runLiveFlow(dispatch, walletHex, publicKey, connection, sendTransaction, generate, ensureApi, derivePrivateKey);
    },
    [connected, publicKey, walletHex, connection, sendTransaction, generate, ensureApi, derivePrivateKey],
  );

  const startFlow = useCallback(() => runFlow("live"), [runFlow]);
  const startDemo = useCallback(() => runFlow("demo"), [runFlow]);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, startFlow, startDemo, reset, canStart: connected && !isRunning, isRunning, isDone, txUrl };
}
