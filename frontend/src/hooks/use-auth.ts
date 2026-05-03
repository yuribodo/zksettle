"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useWallet } from "@/hooks/use-wallet-connection";
import { getMe, signIn as authSignIn, signOut as authSignOut } from "@/lib/auth";

export const authMeQueryKey = ["auth", "me"] as const;

export function useAuthQuery() {
  return useQuery({
    queryKey: authMeQueryKey,
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useSignIn() {
  const queryClient = useQueryClient();
  const { publicKey, signMessage } = useWallet();

  return useMutation({
    mutationFn: async () => {
      if (!publicKey || !signMessage) {
        throw new Error("Wallet not connected or does not support message signing");
      }
      await authSignIn(publicKey, signMessage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authMeQueryKey });
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const { disconnect } = useWallet();

  return useMutation({
    mutationFn: authSignOut,
    onSuccess: () => {
      queryClient.removeQueries();
      disconnect();
    },
  });
}
