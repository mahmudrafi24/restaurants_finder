/**
 * `GET /api/v1/cities/search` — autocomplete for partial place names.
 *
 * Served by Photon on the backend, which does prefix matching; Nominatim (used to resolve a
 * submitted name) only matches whole names and cannot drive a type-ahead. See the API's
 * `app/services/suggest.py`.
 */
import { apiRequest } from "@/lib/api/client";
import { citySearchResponseSchema, MIN_CITY_QUERY_LENGTH, type City } from "@/lib/schemas";

/** Matches the backend's `city_suggestion_limit` default. */
const DEFAULT_SUGGESTION_LIMIT = 8;

/**
 * Return place suggestions for a partial name, best match first.
 *
 * Queries shorter than the API's minimum resolve to `[]` without a request. That is both a
 * courtesy to OpenStreetMap's donated infrastructure and the difference between a working
 * autocomplete and a stream of `422`s as the user types the first character.
 */
export async function searchCities(
  query: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<City[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_CITY_QUERY_LENGTH) return [];

  const response = await apiRequest({
    path: "/api/v1/cities/search",
    schema: citySearchResponseSchema,
    query: { q: trimmed, limit: options.limit ?? DEFAULT_SUGGESTION_LIMIT },
    signal: options.signal,
  });

  return response.results;
}
