import { z } from "zod";

export const TierSchema = z.enum(["developer", "startup", "growth", "enterprise"]);
export type Tier = z.infer<typeof TierSchema>;

export const UsageSchema = z.object({
  tier: TierSchema,
  monthly_limit: z.number().int().nonnegative(),
  usage: z.object({
    request_count: z.number().int().nonnegative(),
    period_start: z.number().int(),
    last_request: z.number().int(),
  }),
});
export type Usage = z.infer<typeof UsageSchema>;

export const DailyUsageSchema = z.object({
  date: z.string(),
  count: z.number().int().nonnegative(),
});
export type DailyUsage = z.infer<typeof DailyUsageSchema>;

export const UsageHistorySchema = z.object({
  tier: TierSchema,
  monthly_limit: z.number().int().nonnegative(),
  history: z.array(DailyUsageSchema),
});
export type UsageHistory = z.infer<typeof UsageHistorySchema>;

export const RootsSchema = z.object({
  membership_root: z.string(),
  sanctions_root: z.string(),
  jurisdiction_root: z.string(),
  last_publish_slot: z.number().int(),
  wallet_count: z.number().int().nonnegative(),
});
export type Roots = z.infer<typeof RootsSchema>;

export const CredentialSchema = z.object({
  wallet: z.array(z.number()).length(32),
  leaf_index: z.number().int().nonnegative(),
  jurisdiction: z.string(),
  issued_at: z.number().int(),
  revoked: z.boolean(),
});
export type Credential = z.infer<typeof CredentialSchema>;

export const RegisterWalletResponseSchema = z.object({
  wallet: z.string(),
  message: z.string(),
});
export type RegisterWalletResponse = z.infer<typeof RegisterWalletResponseSchema>;

export const MembershipProofSchema = z.object({
  wallet: z.string(),
  leaf_index: z.number().int().nonnegative(),
  path: z.array(z.string()),
  path_indices: z.array(z.number().int()),
  root: z.string(),
});
export type MembershipProof = z.infer<typeof MembershipProofSchema>;

export const SanctionsProofSchema = z.object({
  wallet: z.string(),
  path: z.array(z.string()),
  path_indices: z.array(z.number().int()),
  leaf_value: z.string(),
  root: z.string(),
});
export type SanctionsProof = z.infer<typeof SanctionsProofSchema>;

export const EventDtoSchema = z.object({
  signature: z.string(),
  slot: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  issuer: z.string(),
  nullifier_hash: z.string(),
  merkle_root: z.string(),
  sanctions_root: z.string(),
  jurisdiction_root: z.string(),
  mint: z.string(),
  recipient: z.string(),
  payer: z.string(),
  amount: z.number().int().nonnegative(),
  epoch: z.number().int().nonnegative(),
});
export type EventDto = z.infer<typeof EventDtoSchema>;

export const ListEventsResponseSchema = z.object({
  events: z.array(EventDtoSchema),
  next_cursor: z.string().nullable(),
});
export type ListEventsResponse = z.infer<typeof ListEventsResponseSchema>;

export const ApiKeyResponseSchema = z.object({
  api_key: z.string(),
  tier: TierSchema,
  owner: z.string(),
});
export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;

export const ListedKeySchema = z.object({
  key_hash: z.string(),
  tier: TierSchema,
  owner: z.string(),
  created_at: z.number().int(),
});
export type ListedKey = z.infer<typeof ListedKeySchema>;

export const ListKeysResponseSchema = z.object({
  keys: z.array(ListedKeySchema),
});
export type ListKeysResponse = z.infer<typeof ListKeysResponseSchema>;

export const DeleteKeyResponseSchema = z.object({
  key_hash: z.string(),
  deleted: z.boolean(),
});
export type DeleteKeyResponse = z.infer<typeof DeleteKeyResponseSchema>;

export const HealthSchema = z.object({
  status: z.string(),
  version: z.string().optional(),
});
export type Health = z.infer<typeof HealthSchema>;

export const TIER_PRICE_CENTS: Record<Tier, number> = {
  developer: 0,
  startup: 4900,
  growth: 19900,
  enterprise: 49900,
};
