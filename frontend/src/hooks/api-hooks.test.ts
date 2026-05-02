import { describe, expect, it, vi } from "vitest";

const useInfiniteQueryMock = vi.fn((options: unknown) => options);
const useMutationMock = vi.fn((options: unknown) => options);
const useQueryMock = vi.fn((options: unknown) => options);
const invalidateQueriesMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: unknown) => useInfiniteQueryMock(options),
  useMutation: (options: unknown) => useMutationMock(options),
  useQuery: (options: unknown) => useQueryMock(options),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@/lib/api/endpoints", () => ({
  getRoots: vi.fn(),
  getUsage: vi.fn(),
  getUsageHistory: vi.fn(),
  listEvents: vi.fn(),
  publishRoots: vi.fn(),
}));

import { eventsQueryKey, useEvents } from "./use-events";
import { rootsQueryKey, usePublishRoots, useRoots } from "./use-roots";
import { usageHistoryQueryKey, usageQueryKey, useUsage, useUsageHistory } from "./use-usage";

describe("API hooks", () => {
  it("builds stable query keys", () => {
    expect(eventsQueryKey(25, { issuer: "issuer-1" })).toEqual([
      "events",
      { limit: 25, issuer: "issuer-1" },
    ]);
    expect(usageQueryKey).toEqual(["usage"]);
    expect(usageHistoryQueryKey(14)).toEqual(["usage", "history", 14]);
    expect(rootsQueryKey).toEqual(["roots"]);
  });

  it("configures the events infinite query", () => {
    const result = useEvents(25, { issuer: "issuer-1", recipient: "wallet-1" });

    expect(useInfiniteQueryMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      queryKey: ["events", { limit: 25, issuer: "issuer-1", recipient: "wallet-1" }],
      initialPageParam: null,
    });
    expect((result as { getNextPageParam: (page: { next_cursor: string | null }) => string | null })
      .getNextPageParam({ next_cursor: "cursor-2" })).toBe("cursor-2");
  });

  it("configures the usage and roots queries", () => {
    const usage = useUsage();
    const usageHistory = useUsageHistory(14);
    const roots = useRoots();

    expect(useQueryMock).toHaveBeenCalledTimes(3);
    expect(usage).toMatchObject({ queryKey: ["usage"] });
    expect(usageHistory).toMatchObject({ queryKey: ["usage", "history", 14] });
    expect(roots).toMatchObject({ queryKey: ["roots"], refetchInterval: 30_000 });
  });

  it("invalidates the roots query after publishing", () => {
    const mutation = usePublishRoots() as { onSuccess: () => void };

    expect(useMutationMock).toHaveBeenCalledTimes(1);
    mutation.onSuccess();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["roots"] });
  });
});
