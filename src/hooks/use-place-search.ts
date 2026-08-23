"use client";

import { skipToken, useQuery } from "@tanstack/react-query";

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
  return useQuery({
    queryKey: request ? queryKeys.places.search(request) : IDLE_KEY,
    queryFn: request
      ? ({ signal }: { signal: AbortSignal }) => searchPlaces(request, { signal })
      : skipToken,
    staleTime: 10 * 60 * 1000,
  });
}
