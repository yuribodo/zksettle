import { apiFetch } from "./client";
import {
  ApiKeyResponseSchema,
  CredentialSchema,
  DeleteKeyResponseSchema,
  HealthSchema,
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
