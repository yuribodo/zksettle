"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getCredential,
  issueCredential,
  revokeCredential,
} from "@/lib/api/endpoints";

export const credentialQueryKey = (wallet: string) => ["credential", wallet] as const;

export function useCredential(wallet: string | null) {
  return useQuery({
    queryKey: credentialQueryKey(wallet ?? ""),
    queryFn: () => getCredential(wallet as string),
    enabled: !!wallet,
    retry: false,
  });
}

export function useIssueCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { wallet: string; jurisdiction?: string }) => issueCredential(input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: credentialQueryKey(vars.wallet) });
      queryClient.invalidateQueries({ queryKey: ["roots"] });
    },
  });
}

export function useRevokeCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (wallet: string) => revokeCredential(wallet),
    onSuccess: (_data, wallet) => {
      queryClient.invalidateQueries({ queryKey: credentialQueryKey(wallet) });
      queryClient.invalidateQueries({ queryKey: ["roots"] });
    },
  });
}
