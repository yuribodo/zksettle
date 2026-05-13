import { apiFetch, apiFetchBinary } from "./client";
import {
  ApiKeyResponseSchema,
  CredentialSchema,
  DeleteKeyResponseSchema,
  HealthSchema,
  JurisdictionProofSchema,
  ListEventsResponseSchema,
  ListKeysResponseSchema,
  MembershipProofSchema,
  RegisterWalletResponseSchema,
  RootsSchema,
  SanctionsProofSchema,
  UsageHistorySchema,
  UsageSchema,
  type ApiKeyResponse,
  type Credential,
  type DeleteKeyResponse,
  type Health,
  type JurisdictionProof,
  type ListEventsResponse,
  type ListKeysResponse,
  type MembershipProof,
  type RegisterWalletResponse,
  type Roots,
  type SanctionsProof,
  type Usage,
  type UsageHistory,
} from "./schemas";

export const getHealth = async (): Promise<Health> =>
  HealthSchema.parse(await apiFetch("/health"));

export const getUsage = async (): Promise<Usage> =>
  UsageSchema.parse(await apiFetch("/usage"));

export const getUsageHistory = async (days = 30): Promise<UsageHistory> =>
  UsageHistorySchema.parse(await apiFetch(`/usage/history?days=${days}`));

export const getRoots = async (): Promise<Roots> =>
  RootsSchema.parse(await apiFetch("/v1/roots"));

export const getCredential = async (wallet: string): Promise<Credential> =>
  CredentialSchema.parse(await apiFetch(`/v1/credentials/${wallet}`));

export const getMembershipProof = async (wallet: string): Promise<MembershipProof> =>
  MembershipProofSchema.parse(await apiFetch(`/v1/proofs/membership/${wallet}`));

export const getSanctionsProof = async (wallet: string): Promise<SanctionsProof> =>
  SanctionsProofSchema.parse(await apiFetch(`/v1/proofs/sanctions/${wallet}`));

export const getJurisdictionProof = async (wallet: string): Promise<JurisdictionProof> =>
  JurisdictionProofSchema.parse(await apiFetch(`/v1/proofs/jurisdiction/${wallet}`));

export const registerWallet = async (wallet: string): Promise<RegisterWalletResponse> =>
  RegisterWalletResponseSchema.parse(
    await apiFetch("/v1/wallets", {
      method: "POST",
      body: JSON.stringify({ wallet }),
    }),
  );

export const issueCredential = (body: { wallet: string; jurisdiction?: string }) =>
  apiFetch<{ wallet: string; leaf_index: number; jurisdiction: string }>("/v1/credentials", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const revokeCredential = (wallet: string) =>
  apiFetch<{ wallet: string; revoked: boolean }>(`/v1/credentials/${wallet}`, {
    method: "DELETE",
  });

export const publishRoots = () =>
  apiFetch<{ slot: number; registered: boolean }>("/v1/roots/publish", { method: "POST" });

const GROTH16_WITNESS_HEADER_LEN = 12;
const GROTH16_FIELD_LEN = 32;
const GROTH16_NUM_PUBLIC_INPUTS = 11;
const GROTH16_PUBLIC_WITNESS_LEN =
  GROTH16_WITNESS_HEADER_LEN + GROTH16_NUM_PUBLIC_INPUTS * GROTH16_FIELD_LEN;
// Real proofs are 388 B; cap well above that to prevent a malformed
// `x-proof-len` header from triggering a runaway Uint8Array allocation
// before the length-mismatch check fires.
const GROTH16_PROOF_MAX_LEN = 4096;

export interface Groth16ProofBundle {
  /**
   * Concatenated `proof || public-witness` bytes — what the on-chain verifier
   * deserialises from `hook_payload.proof_and_witness`. `split_proof_and_witness`
   * peels the trailing `12 + 11*32 = 364` witness bytes back off, so the bundle
   * MUST contain both halves; uploading only the proof slice yields a
   * `ProofConversionError` on-chain.
   */
  proof: Uint8Array;
  /** 11 BE 32-byte field elements parsed from the public-witness, as `0x`-hex strings. */
  publicInputs: string[];
}

/**
 * Server-side Sunspot Groth16 prover. Posts the gzipped Noir witness emitted
 * by `noir.execute(...)` and returns the bundle the on-chain `gnark_verifier_solana`
 * verifier consumes. `publicInputs` mirrors the legacy `bb.js` shape so callers
 * keep `ProofResult` unchanged.
 */
export const proveGroth16 = async (witnessGz: Uint8Array): Promise<Groth16ProofBundle> => {
  const { body, headers } = await apiFetchBinary("/v1/prove/groth16", {
    method: "POST",
    body: witnessGz,
  });

  const proofLen = Number.parseInt(headers.get("x-proof-len") ?? "", 10);
  const witnessLen = Number.parseInt(headers.get("x-witness-len") ?? "", 10);
  if (!Number.isFinite(proofLen) || !Number.isFinite(witnessLen)) {
    throw new Error(
      `proveGroth16: missing/invalid length headers (proof=${proofLen}, witness=${witnessLen})`,
    );
  }
  if (proofLen < 0 || proofLen > GROTH16_PROOF_MAX_LEN) {
    throw new Error(
      `proveGroth16: proof length ${proofLen} outside sane bounds (0..${GROTH16_PROOF_MAX_LEN})`,
    );
  }
  if (proofLen + witnessLen !== body.length) {
    throw new Error(
      `proveGroth16: length mismatch (proof=${proofLen} + witness=${witnessLen} != body=${body.length})`,
    );
  }
  if (witnessLen !== GROTH16_PUBLIC_WITNESS_LEN) {
    throw new Error(
      `proveGroth16: unexpected public-witness length ${witnessLen} (expected ${GROTH16_PUBLIC_WITNESS_LEN})`,
    );
  }

  const pwBody = body.subarray(proofLen + GROTH16_WITNESS_HEADER_LEN, proofLen + witnessLen);
  const publicInputs: string[] = [];
  for (let i = 0; i < GROTH16_NUM_PUBLIC_INPUTS; i++) {
    const off = i * GROTH16_FIELD_LEN;
    const field = pwBody.subarray(off, off + GROTH16_FIELD_LEN);
    let hex = "0x";
    for (const b of field) hex += b.toString(16).padStart(2, "0");
    publicInputs.push(hex);
  }
  // Copy the full `proof || public-witness` bundle so callers don't accidentally
  // retain the backing fetch buffer. This is exactly what `uploadProofChunked`
  // stages into `hook_payload.proof_and_witness`.
  return { proof: new Uint8Array(body), publicInputs };
};

export const createApiKey = async (owner: string): Promise<ApiKeyResponse> =>
  ApiKeyResponseSchema.parse(
    await apiFetch("/api-keys", {
      method: "POST",
      body: JSON.stringify({ owner }),
    }),
  );

export const listApiKeys = async (): Promise<ListKeysResponse> =>
  ListKeysResponseSchema.parse(await apiFetch("/api-keys"));

export const deleteApiKey = async (keyHash: string): Promise<DeleteKeyResponse> =>
  DeleteKeyResponseSchema.parse(
    await apiFetch(`/api-keys/${encodeURIComponent(keyHash)}`, { method: "DELETE" }),
  );

export interface ListEventsParams {
  cursor?: string | null;
  limit?: number;
  fromTs?: number;
  toTs?: number;
  issuer?: string;
  recipient?: string;
}

export const listEvents = async (
  params: ListEventsParams,
): Promise<ListEventsResponse> => {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.fromTs !== undefined) search.set("from_ts", String(params.fromTs));
  if (params.toTs !== undefined) search.set("to_ts", String(params.toTs));
  if (params.issuer) search.set("issuer", params.issuer);
  if (params.recipient) search.set("recipient", params.recipient);
  const query = search.toString();
  const path = query ? `/v1/events?${query}` : "/v1/events";
  return ListEventsResponseSchema.parse(await apiFetch(path));
};
