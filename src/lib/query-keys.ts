/**
 * TanStack Query cache keys, defined in one place.
 *
 * Centralising them keeps invalidation honest: a key built inline at a call site is impossible to
 * target later without duplicating its exact structure.
 */
import type { SearchRequest } from "@/lib/schemas";

export const queryKeys = {
  cities: {
    all: ["cities"] as const,
    search: (query: string, limit: number) => ["cities", "search", query, limit] as const,
  },
  places: {
    all: ["places"] as const,
    /**
     * Every parameter that changes the result is part of the key, so switching radius or amenity
     * filters is a cache miss rather than a stale hit — and switching back is instant.
     */
    search: (request: SearchRequest) =>
      [
        "places",
        "search",
        {
          city: request.city.toLowerCase(),
          radiusKm: request.radius_km,
          // Sorted: `[cafe, restaurant]` and `[restaurant, cafe]` return identical data, and
          // should therefore share a cache entry.
          amenities: [...request.amenities].sort(),
          latitude: request.latitude ?? null,
          longitude: request.longitude ?? null,
        },
      ] as const,
  },
} as const;
