"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { listEvents, type ListEventsParams } from "@/lib/api/endpoints";

export type EventsFilters = Pick<
  ListEventsParams,
  "fromTs" | "toTs" | "issuer" | "recipient"
>;

export const eventsQueryKey = (limit: number, filters: EventsFilters) =>
  ["events", { limit, ...filters }] as const;

export function useEvents(limit = 20, filters: EventsFilters = {}) {
  return useInfiniteQuery({
    queryKey: eventsQueryKey(limit, filters),
    queryFn: ({ pageParam }) => listEvents({ cursor: pageParam, limit, ...filters }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
}
