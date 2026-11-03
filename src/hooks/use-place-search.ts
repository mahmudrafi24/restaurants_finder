"use client";

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";

import { searchPlaces } from "@/lib/api/places";
import { queryKeys } from "@/lib/query-keys";
import type { SearchRequest } from "@/lib/schemas";

/** Key used while no search has been submitted; never fetched. */
const IDLE_KEY = ["places", "search", "idle"] as const;

/**
 * Run a place search, or stay idle when `request` is `null`.
 *
 * `skipToken` rather than `enabled: false`: it disables the query *and* narrows the type, so the
 * query function never needs a non-null assertion on a request that cannot be null when it runs.
 *
 * Results are cached per distinct request, so toggling a filter and toggling it back is instant
 * instead of costing another multi-second Overpass query.
 */
export function usePlaceSearch(request: SearchRequest | null) {
  const client = useQueryClient();
  const key = request ? queryKeys.places.search(request) : IDLE_KEY;
  const query = useQuery({
    queryKey: key,
    queryFn: request
      ? ({ signal }: { signal: AbortSignal }) => searchPlaces(request, { signal })
      : skipToken,
    staleTime: 10 * 60 * 1000,
    // A failed search can already have consumed the API's entire 55-second budget.
    // Let the user change the radius or retry rather than silently repeating it.
    retry: false,
    refetchOnReconnect: false,
  });
  return {
    data: query.data,
    error: query.error,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    cancel: () => client.cancelQueries({ queryKey: key, exact: true }),
  };
}
