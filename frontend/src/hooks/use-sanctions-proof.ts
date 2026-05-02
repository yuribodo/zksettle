"use client";

import { useQuery } from "@tanstack/react-query";

import { getSanctionsProof } from "@/lib/api/endpoints";

export const sanctionsProofQueryKey = (wallet: string) =>
  ["sanctions-proof", wallet] as const;

export function useSanctionsProof(wallet: string | null) {
  return useQuery({
    queryKey: sanctionsProofQueryKey(wallet ?? ""),
    queryFn: () => getSanctionsProof(wallet as string),
    enabled: !!wallet,
    retry: false,
  });
}
