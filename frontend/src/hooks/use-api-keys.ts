"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createApiKey, deleteApiKey, listApiKeys } from "@/lib/api/endpoints";
import type { ApiKeyResponse } from "@/lib/api/schemas";

const PREFIX_STORAGE_KEY = "zks.api_key_prefixes.v1";
const STORED_KEYS_STORAGE_KEY = "zks.stored_api_keys.v1";

type PrefixMap = Record<string, string>;
type StoredKeyMap = Record<string, string>;

function readPrefixes(): PrefixMap {
  if (typeof globalThis.window === "undefined") return {};
  try {
    const raw = globalThis.window.localStorage.getItem(PREFIX_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as PrefixMap;
  } catch {
    return {};
  }
}

function writePrefixes(map: PrefixMap): void {
  if (typeof globalThis.window === "undefined") return;
  globalThis.window.localStorage.setItem(PREFIX_STORAGE_KEY, JSON.stringify(map));
}

function readStoredKeys(): StoredKeyMap {
  if (typeof globalThis.window === "undefined") return {};
  try {
    const raw = globalThis.window.localStorage.getItem(STORED_KEYS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as StoredKeyMap;
  } catch {
    return {};
  }
}

function writeStoredKeys(map: StoredKeyMap): void {
  if (typeof globalThis.window === "undefined") return;
  globalThis.window.localStorage.setItem(STORED_KEYS_STORAGE_KEY, JSON.stringify(map));
}

export function rememberKeyPrefix(keyHash: string, prefix: string): void {
  const map = readPrefixes();
  map[keyHash] = prefix;
  writePrefixes(map);
}

export function lookupKeyPrefix(keyHash: string): string | null {
  return readPrefixes()[keyHash] ?? null;
}

export function forgetKeyPrefix(keyHash: string): void {
  const map = readPrefixes();
  if (delete map[keyHash]) writePrefixes(map);
}

export function storeFullKey(keyHash: string, fullKey: string): void {
  const map = readStoredKeys();
  map[keyHash] = fullKey;
  writeStoredKeys(map);
}

export function lookupFullKey(keyHash: string): string | null {
  return readStoredKeys()[keyHash] ?? null;
}

export function forgetStoredKey(keyHash: string): void {
  const map = readStoredKeys();
  if (delete map[keyHash]) writeStoredKeys(map);
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function prefixForRevealedKey(apiKey: string): string {
  if (apiKey.length <= 12) return apiKey;
  return `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
}

export const apiKeysQueryKey = ["api-keys"] as const;

export function useApiKeys() {
  return useQuery({
    queryKey: apiKeysQueryKey,
    queryFn: listApiKeys,
  });
}

export interface CreatedKey extends ApiKeyResponse {
  createdAt: number;
  keyHash: string;
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (owner: string): Promise<CreatedKey> => {
      const created = await createApiKey(owner);
      const keyHash = await sha256Hex(created.api_key);
      rememberKeyPrefix(keyHash, prefixForRevealedKey(created.api_key));
      storeFullKey(keyHash, created.api_key);
      return { ...created, createdAt: Date.now(), keyHash };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyHash: string) => deleteApiKey(keyHash),
    onSuccess: (_data, keyHash) => {
      forgetKeyPrefix(keyHash);
      forgetStoredKey(keyHash);
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}
