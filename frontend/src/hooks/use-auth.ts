"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useWallet } from "@/hooks/use-wallet-connection";
import { clearActiveApiKey, setActiveApiKey, fetchActiveKeyStatus } from "@/lib/api/active-key";
import { createApiKey } from "@/lib/api/endpoints";
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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      try {
        const status = await fetchActiveKeyStatus();
        if (!status.hasKey) {
          const { api_key } = await createApiKey("dashboard");
          await setActiveApiKey(api_key);
        }
      } catch {
        // Non-fatal: user can still create a key manually via the gate
      }
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { disconnect } = useWallet();

  return useMutation({
    mutationFn: authSignOut,
    // onSettled instead of onSuccess so we still tear the session down if the
    // gateway's /auth/logout returns a non-2xx (already-expired session, etc).
    onSettled: () => {
      // Push null synchronously so subscribed observers (RequireAuth's
      // useAuth) re-render immediately. removeQueries() alone unsubscribes
      // observers without triggering re-renders, which is what was leaving
      // the UI looking logged-in until a manual refresh.
      queryClient.setQueryData(authMeQueryKey, null);
      queryClient.clear();
      disconnect();
      router.replace("/login");
      // Fire-and-forget: clearing the local active-key cookie shouldn't block
      // the redirect.
      void clearActiveApiKey().catch(() => {});
    },
  });
}
