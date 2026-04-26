import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => {
          if (err instanceof ApiError) {
            if (err.status === 401 || err.status === 403 || err.status === 404) {
              return false;
            }
          }
          return count < 2;
        },
      },
    },
  });
}
