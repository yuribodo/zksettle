"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getRoots, publishRoots } from "@/lib/api/endpoints";

export const rootsQueryKey = ["roots"] as const;

export function useRoots() {
  return useQuery({
    queryKey: rootsQueryKey,
    queryFn: getRoots,
    refetchInterval: 30_000,
  });
}

export function usePublishRoots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publishRoots,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rootsQueryKey });
    },
  });
}
