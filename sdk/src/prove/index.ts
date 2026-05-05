import type { InputMap } from "@noir-lang/noir_js";
import type {
  ProofInputs,
  ProofResult,
  TransferContext,
  ZkSettleConfig,
} from "../types.js";
import { IssuerClient } from "../issuer/client.js";
import { loadCircuit } from "./circuit-loader.js";
import { Prover } from "./prover.js";

export { loadCircuit } from "./circuit-loader.js";
export { Prover } from "./prover.js";

/**
 * Translate camelCase TypeScript `ProofInputs` to the snake_case parameter
 * names declared in the Noir circuit ABI (`circuits/src/main.nr`).
 */
function toNoirInputs(inputs: ProofInputs): InputMap {
  return {
    merkle_root: inputs.merkleRoot,
    nullifier: inputs.nullifier,
    mint_lo: inputs.mintLo,
    mint_hi: inputs.mintHi,
    epoch: inputs.epoch,
    recipient_lo: inputs.recipientLo,
    recipient_hi: inputs.recipientHi,
    amount: inputs.amount,
    sanctions_root: inputs.sanctionsRoot,
    jurisdiction_root: inputs.jurisdictionRoot,
    timestamp: inputs.timestamp,
    wallet: inputs.wallet,
    path: inputs.path,
    path_indices: inputs.pathIndices,
    private_key: inputs.privateKey,
    sanctions_path: inputs.sanctionsPath,
    sanctions_path_indices: inputs.sanctionsPathIndices,
    sanctions_leaf_value: inputs.sanctionsLeafValue,
    jurisdiction: inputs.jurisdiction,
    jurisdiction_path: inputs.jurisdictionPath,
    jurisdiction_path_indices: inputs.jurisdictionPathIndices,
    credential_expiry: inputs.credentialExpiry,
  } satisfies InputMap;
}

// ─── Overload signatures ────────────────────────────────────────────────────

/**
 * Low-level: generate a proof from pre-assembled `ProofInputs`.
 */
export async function prove(
  inputs: ProofInputs,
  config?: ZkSettleConfig,
): Promise<ProofResult>;

/**
 * High-level: fetch Merkle paths from the issuer service, assemble inputs,
 * and generate a proof in one call.
 */
export async function prove(
  wallet: string,
  context: TransferContext,
  config?: ZkSettleConfig,
): Promise<ProofResult>;

// ─── Implementation ─────────────────────────────────────────────────────────

export async function prove(
  inputsOrWallet: ProofInputs | string,
  contextOrConfig?: TransferContext | ZkSettleConfig,
  maybeConfig?: ZkSettleConfig,
): Promise<ProofResult> {
  // Discriminate overload: if first arg is a string it's the high-level path.
  if (typeof inputsOrWallet === "string") {
    const wallet = inputsOrWallet;
    const context = contextOrConfig as TransferContext;
    const config = maybeConfig;
    return proveHighLevel(wallet, context, config);
  }

  // Low-level path
  const inputs = inputsOrWallet as ProofInputs;
  const config = contextOrConfig as ZkSettleConfig | undefined;
  return proveLowLevel(inputs, config);
}

// ─── Internal helpers ───────────────────────────────────────────────────────

async function proveLowLevel(
  inputs: ProofInputs,
  config?: ZkSettleConfig,
): Promise<ProofResult> {
  if (!config?.circuitSource) {
    throw new Error(
      "prove() requires config.circuitSource (URL, file path, Uint8Array, or CompiledCircuit)",
    );
  }

  const circuit = await loadCircuit(config.circuitSource);
  const prover = new Prover(circuit, config.threads);

  const start = performance.now();
  try {
    const { proof, publicInputs } = await prover.generateProof(
      toNoirInputs(inputs),
    );
    const durationMs = performance.now() - start;
    return { proof, publicInputs, durationMs };
  } finally {
    await prover.destroy();
  }
}

async function proveHighLevel(
  wallet: string,
  context: TransferContext,
  config?: ZkSettleConfig,
): Promise<ProofResult> {
  if (!config?.issuerServiceUrl) {
    throw new Error(
      "prove() high-level overload requires config.issuerServiceUrl",
    );
  }
  if (!config.circuitSource) {
    throw new Error(
      "prove() high-level overload requires config.circuitSource",
    );
  }

  const issuer = new IssuerClient(config.issuerServiceUrl);

  // Fetch Merkle paths and credential in parallel
  const [roots, membership, sanctions, credential] = await Promise.all([
    issuer.getRoots(),
    issuer.getMembershipProof(wallet),
    issuer.getSanctionsProof(wallet),
    issuer.getCredential(wallet),
  ]);

  // Split mint and recipient public keys into lo/hi 128-bit halves (hex)
  const mintBytes = context.mint.toBytes();
  const recipientBytes = context.recipient.toBytes();

  const toHex = (bytes: Uint8Array): string =>
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const mintLo = toHex(mintBytes.slice(0, 16));
  const mintHi = toHex(mintBytes.slice(16, 32));
  const recipientLo = toHex(recipientBytes.slice(0, 16));
  const recipientHi = toHex(recipientBytes.slice(16, 32));

  const epoch = (context.epoch ?? 0).toString();
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const inputs: ProofInputs = {
    merkleRoot: roots.membership_root,
    nullifier: "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    mintLo,
    mintHi,
    epoch,
    recipientLo,
    recipientHi,
    amount: context.amount.toString(),
    sanctionsRoot: roots.sanctions_root,
    jurisdictionRoot: roots.jurisdiction_root,
    timestamp,
    wallet,
    path: membership.path,
    pathIndices: membership.path_indices,
    privateKey: "", // must be supplied by caller's secure context
    sanctionsPath: sanctions.path,
    sanctionsPathIndices: sanctions.path_indices,
    sanctionsLeafValue: sanctions.leaf_value,
    jurisdiction: credential.jurisdiction,
    jurisdictionPath: [], // populated by issuer when available
    jurisdictionPathIndices: [],
    credentialExpiry: credential.issued_at.toString(),
  };

  return proveLowLevel(inputs, config);
}
