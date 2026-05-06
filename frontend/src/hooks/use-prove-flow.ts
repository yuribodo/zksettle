"use client";

import { useCallback, useReducer } from "react";

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
} from "@/lib/prove-flow";

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
  const isDone =
    state.steps[state.steps.length - 1]?.status === "success";
  const txUrl = state.txSignature
    ? `https://solscan.io/tx/${state.txSignature}?cluster=devnet`
    : null;

  const runFlow = useCallback(
    async (mode: "live" | "demo") => {
      dispatch({ type: "START_FLOW", mode });

      // Step 0: Connect
      dispatch({ type: "STEP_RUNNING", step: 0 });
      if (!connected || !publicKey) {
        dispatch({
          type: "STEP_ERROR",
          step: 0,
          error: "Wallet not connected. Please connect your wallet first.",
        });
        return;
      }
      dispatch({ type: "STEP_SUCCESS", step: 0 });

      if (mode === "demo") {
        dispatch({ type: "STEP_RUNNING", step: 1 });
        dispatch({ type: "STEP_SUCCESS", step: 1, data: { demo: true } });

        dispatch({ type: "STEP_RUNNING", step: 2 });
        dispatch({ type: "STEP_SUCCESS", step: 2, data: { demo: true } });

        dispatch({ type: "STEP_RUNNING", step: 3 });
        try {
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
        } catch (err) {
          dispatch({
            type: "STEP_ERROR",
            step: 3,
            error:
              err instanceof Error ? err.message : "Proof generation failed",
          });
          return;
        }

        // Skip submit in demo mode
        dispatch({ type: "STEP_RUNNING", step: 4 });
        dispatch({ type: "STEP_SUCCESS", step: 4, data: { skipped: true } });

        dispatch({ type: "STEP_RUNNING", step: 5 });
        dispatch({ type: "STEP_SUCCESS", step: 5, data: { demo: true } });
        return;
      }

      // Live mode — call API endpoints directly to avoid react-query
      // cache/retry/rate-limit interference.
      if (!walletHex) {
        dispatch({ type: "STEP_ERROR", step: 1, error: "Wallet not resolved." });
        return;
      }

      // Step 1: Credential
      dispatch({ type: "STEP_RUNNING", step: 1 });
      let credential;
      try {
        const start = performance.now();
        credential = await getCredential(walletHex);
        if (credential.revoked) {
          dispatch({
            type: "STEP_ERROR",
            step: 1,
            error: "Credential has been revoked.",
          });
          return;
        }
        dispatch({
          type: "STEP_SUCCESS",
          step: 1,
          data: { jurisdiction: credential.jurisdiction },
          durationMs: performance.now() - start,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch credential";
        dispatch({
          type: "STEP_ERROR",
          step: 1,
          error: msg.includes("404")
            ? "No credential found for this wallet. Issue one from the Wallets & Credentials page, or try demo mode."
            : msg,
        });
        return;
      }

      // Step 2: Merkle paths + jurisdiction proof + ZK private key
      dispatch({ type: "STEP_RUNNING", step: 2 });
      let membership, sanctions, roots, jurisdictionProof, zkPrivateKey: string;
      try {
        const start = performance.now();
        [membership, sanctions, roots, jurisdictionProof, zkPrivateKey] =
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
      } catch (err) {
        dispatch({
          type: "STEP_ERROR",
          step: 2,
          error:
            err instanceof Error
              ? err.message
              : "Failed to fetch Merkle paths",
        });
        return;
      }

      // Step 3: Proof generation
      dispatch({ type: "STEP_RUNNING", step: 3 });
      let proofResult;
      const toHex = (bytes: Uint8Array) =>
        "0x" +
        Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      const mintBytes = publicKey.toBytes();
      const recipientBytes = publicKey.toBytes();
      const mintLo = toHex(mintBytes.slice(0, 16));
      const mintHi = toHex(mintBytes.slice(16, 32));
      const recipientLo = toHex(recipientBytes.slice(0, 16));
      const recipientHi = toHex(recipientBytes.slice(16, 32));
      const epoch = String(Math.floor(Date.now() / 1000 / 86400));
      const amount = "1000";
      const timestamp = String(Math.floor(Date.now() / 1000));
      const credentialExpiry = String(
        credential.issued_at + CREDENTIAL_VALIDITY_SECS,
      );
      try {
        const api = await ensureApi();
        const nullifier = await computeNullifier(
          api,
          zkPrivateKey,
          mintLo,
          mintHi,
          epoch,
          recipientLo,
          recipientHi,
          amount,
        );

        const inputs = assembleProofInputs(
          credential,
          membership,
          sanctions,
          roots,
          {
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
          },
        );

        proofResult = await generate(inputs);
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
      } catch (err) {
        dispatch({
          type: "STEP_ERROR",
          step: 3,
          error:
            err instanceof Error ? err.message : "Proof generation failed",
        });
        return;
      }

      // Step 4: Submit on-chain
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
      } else {
        try {
          const start = performance.now();
          const { wrap } = await import("@zksettle/sdk/wrap");

          const nullifierHex = proofResult.publicInputs[1] ?? "";
          const cleanHex = nullifierHex.startsWith("0x")
            ? nullifierHex.slice(2)
            : nullifierHex;
          const nullifierBytes = new Uint8Array(
            cleanHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
          );

          const tx = await wrap({
            connection,
            wallet: publicKey,
            proof: proofResult.proof,
            nullifierHash: nullifierBytes,
            transferContext: {
              mint: publicKey,
              recipient: publicKey,
              amount: 1000 as any,
              epoch: Math.floor(Date.now() / 1000 / 86400),
              privateKey: zkPrivateKey,
              credentialExpiry,
              jurisdictionPath: jurisdictionProof.path.map((h) =>
                h.startsWith("0x") ? h : `0x${h}`,
              ),
              jurisdictionPathIndices: jurisdictionProof.path_indices,
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
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Transaction failed";
          const isRejected =
            message.includes("rejected") || message.includes("User rejected");
          dispatch({
            type: "STEP_ERROR",
            step: 4,
            error: isRejected
              ? "Transaction rejected by wallet."
              : message,
          });
          return;
        }
      }

      // Step 5: Confirm result
      dispatch({ type: "STEP_RUNNING", step: 5 });
      try {
        const start = performance.now();
        if (state.txSignature) {
          await connection.confirmTransaction(state.txSignature, "confirmed");
        }
        dispatch({
          type: "STEP_SUCCESS",
          step: 5,
          durationMs: performance.now() - start,
        });
      } catch {
        dispatch({ type: "STEP_SUCCESS", step: 5 });
      }
    },
    [
      connected,
      publicKey,
      walletHex,
      connection,
      sendTransaction,
      generate,
      ensureApi,
      derivePrivateKey,
      state.txSignature,
    ],
  );

  const startFlow = useCallback(() => runFlow("live"), [runFlow]);
  const startDemo = useCallback(() => runFlow("demo"), [runFlow]);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    state,
    startFlow,
    startDemo,
    reset,
    canStart: connected && !isRunning,
    isRunning,
    isDone,
    txUrl,
  };
}

function formatProofPreview(proof: Uint8Array): string {
  return Array.from(proof.slice(0, 32))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
