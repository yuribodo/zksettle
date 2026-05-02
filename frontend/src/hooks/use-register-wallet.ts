"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { registerWallet } from "@/lib/api/endpoints";
import { credentialQueryKey } from "@/hooks/use-credential";
import { rootsQueryKey } from "@/hooks/use-roots";

export function useRegisterWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (wallet: string) => registerWallet(wallet),
    onSuccess: (_data, wallet) => {
      queryClient.invalidateQueries({ queryKey: credentialQueryKey(wallet) });
      queryClient.invalidateQueries({ queryKey: rootsQueryKey });
    },
  });
}
