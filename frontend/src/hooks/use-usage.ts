import { useQuery } from "@tanstack/react-query";

import { getUsage, getUsageHistory } from "@/lib/api/endpoints";

export const usageQueryKey = ["usage"] as const;

export function useUsage() {
  return useQuery({
    queryKey: usageQueryKey,
    queryFn: getUsage,
  });
}

export const usageHistoryQueryKey = (days: number) => ["usage", "history", days] as const;

export function useUsageHistory(days = 30) {
  return useQuery({
    queryKey: usageHistoryQueryKey(days),
    queryFn: () => getUsageHistory(days),
  });
}
