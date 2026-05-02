"use client";

import { useQuery } from "@tanstack/react-query";

import { getMembershipProof } from "@/lib/api/endpoints";

export const membershipProofQueryKey = (wallet: string) =>
  ["membership-proof", wallet] as const;

export function useMembershipProof(wallet: string | null) {
  return useQuery({
    queryKey: membershipProofQueryKey(wallet ?? ""),
    queryFn: () => getMembershipProof(wallet as string),
    enabled: !!wallet,
    retry: false,
  });
}
