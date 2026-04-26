"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "zks.recent_wallets.v1";
const MAX_ENTRIES = 8;

export interface RecentWallet {
  wallet: string;
  lastSeenAt: number;
}

function read(): RecentWallet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentWallet =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as RecentWallet).wallet === "string" &&
        typeof (e as RecentWallet).lastSeenAt === "number",
    );
  } catch {
    return [];
  }
}

function write(entries: RecentWallet[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export const recentWalletsKey = ["recent-wallets"] as const;

export function useRecentWallets() {
  return useQuery({
    queryKey: recentWalletsKey,
    queryFn: () => Promise.resolve(read()),
    staleTime: Infinity,
  });
}

export function useRecordWallet() {
  const queryClient = useQueryClient();
  return (wallet: string) => {
    const without = read().filter((e) => e.wallet !== wallet);
    const next = [{ wallet, lastSeenAt: Date.now() }, ...without].slice(0, MAX_ENTRIES);
    write(next);
    queryClient.setQueryData(recentWalletsKey, next);
  };
}

export function useForgetWallet() {
  const queryClient = useQueryClient();
  return (wallet: string) => {
    const next = read().filter((e) => e.wallet !== wallet);
    write(next);
    queryClient.setQueryData(recentWalletsKey, next);
  };
}
