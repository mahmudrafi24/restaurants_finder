/**
 * TanStack Query configuration.
 *
 * Kept out of the provider component so the defaults are readable in one place and can be reused
 * by tests without rendering a tree.
 */
import { QueryClient } from "@tanstack/react-query";

import { isApiError } from "@/lib/api/client";

/** Attempts after the initial one, for failures that could plausibly succeed on a retry. */
const MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 30_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // City coordinates and OSM data change on the order of days, and a search costs the
        // upstream real work — so cached results stay fresh for a long time.
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        // A completed search must not silently re-run because the user switched tabs and came
        // back: it is a multi-second, multi-thousand-row upstream query, not a cheap poll.
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // `ApiError.isRetryable` distinguishes "the city does not exist" (never retry) from
          // "the upstream is rate limiting" (worth another attempt).
          if (isApiError(error)) {
            return error.isRetryable && failureCount < MAX_RETRIES;
          }
          return false;
        },
        retryDelay: (attempt, error) => {
          // Honour an explicit Retry-After relayed by the API before falling back to backoff.
          const requested = isApiError(error) ? error.retryAfterSeconds : null;
          if (requested !== null) {
            return Math.min(requested * 1000, MAX_RETRY_DELAY_MS);
          }
          return Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
        },
      },
      mutations: {
        // Exports are explicit user actions; a silent retry of a failed download is confusing.
        retry: false,
      },
    },
  });
}
