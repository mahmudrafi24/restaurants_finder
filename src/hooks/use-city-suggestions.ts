"use client";

import { useQuery } from "@tanstack/react-query";

import { searchCities } from "@/lib/api/cities";
import { queryKeys } from "@/lib/query-keys";
import { MIN_CITY_QUERY_LENGTH } from "@/lib/schemas";

/** Matches the backend's `city_suggestion_limit` default. */
const SUGGESTION_LIMIT = 8;

/**
 * City suggestions for a (already debounced) partial name.
 *
 * Suggestions are cached aggressively — city coordinates do not move, and the upstream runs on
 * donated infrastructure — so backspacing through a name replays from cache rather than
 * re-querying.
 */
export function useCitySuggestions(query: string, options: { enabled?: boolean } = {}) {
  const normalised = query.trim().toLowerCase();

  return useQuery({
    queryKey: queryKeys.cities.search(normalised, SUGGESTION_LIMIT),
    queryFn: ({ signal }) => searchCities(normalised, { limit: SUGGESTION_LIMIT, signal }),
    enabled: (options.enabled ?? true) && normalised.length >= MIN_CITY_QUERY_LENGTH,
    staleTime: 10 * 60 * 1000,
    // A failed suggestion lookup is not worth hammering the upstream over; the user is still
    // typing, and the next keystroke issues a fresh request anyway.
    retry: false,
  });
}
