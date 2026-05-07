"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  clearActiveApiKey,
  getActiveApiKey,
  setActiveApiKey as setStoredKey,
} from "@/lib/active-key";
import { useApiKeys } from "@/hooks/use-api-keys";

const ACTIVE_KEY_QUERY_KEY = ["active-api-key"] as const;

export function useActiveKey() {
  return useQuery({
    queryKey: ACTIVE_KEY_QUERY_KEY,
    queryFn: () => getActiveApiKey(),
    staleTime: Infinity,
    structuralSharing: (oldData, newData) =>
      oldData === newData ? oldData : newData,
  });
}

export function useSetActiveKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      setStoredKey(key);
      return key;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY_QUERY_KEY });
    },
  });
}

export function useClearActiveKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      clearActiveApiKey();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVE_KEY_QUERY_KEY });
    },
  });
}

export interface KeyStatus {
  hasKey: boolean;
  activeKey: string | null;
  availableKeys: number;
  isLoading: boolean;
}

export function useKeyStatus(): KeyStatus {
  const { data: activeKey, isLoading: activeLoading } = useActiveKey();
  const { data: keysData, isLoading: keysLoading } = useApiKeys();

  return {
    hasKey: !!activeKey,
    activeKey: activeKey ?? null,
    availableKeys: keysData?.keys.length ?? 0,
    isLoading: activeLoading || keysLoading,
  };
}
