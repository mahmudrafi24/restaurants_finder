/**
 * Zod schemas mirroring the FastAPI contract.
 *
 * These are the single source of truth for the shapes crossing the network. Responses are parsed
 * rather than cast, so a backend change that drops or renames a field fails loudly at the
 * boundary instead of producing `undefined` deep inside a table cell.
 *
 * ## Naming
 *
 * Wire types keep the API's `snake_case` field names. That is deliberate: `Place` objects are
 * posted back to `/places/export` verbatim, so any camelCase translation would have to be
 * reversed exactly, and a mismatch there would silently corrupt exports. Keeping one consistent
 * convention for everything that touches the wire is simpler than mapping some types and not
 * others. UI-local state (form values, table config) uses idiomatic camelCase; the conversion
 * happens in one place, `toSearchRequest`.
 *
 * Limits duplicated from the backend (`app/schemas/place.py`) are re-stated here so the UI can
 * disable controls before a request is made. The server remains the authority — client-side
 * validation is for feedback, not enforcement.
 */
import { z } from "zod";

// ── Constants (mirrors app/schemas/place.py) ─────────────────────────────────

export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 25;
export const DEFAULT_RADIUS_KM = 5;

/** Cap the backend enforces on `/places/export`; also keeps the body under Vercel's 4.5 MB. */
export const MAX_EXPORT_ROWS = 10_000;
export const MAX_REQUEST_BYTES = 4_000_000;

/** Shortest query the `/cities/search` endpoint accepts. */
export const MIN_CITY_QUERY_LENGTH = 2;

export const AMENITY_TYPES = ["cafe", "restaurant", "fast_food"] as const;
export const EXPORT_FORMATS = ["xlsx", "csv", "geojson"] as const;

export const amenityTypeSchema = z.enum(AMENITY_TYPES);
export const exportFormatSchema = z.enum(EXPORT_FORMATS);

export type AmenityType = z.infer<typeof amenityTypeSchema>;
export type ExportFormat = z.infer<typeof exportFormatSchema>;

/** Display labels for the OSM `amenity` values, matching the backend's `AmenityType.label`. */
export const AMENITY_LABELS: Record<AmenityType, string> = {
  cafe: "Cafe",
  restaurant: "Restaurant",
  fast_food: "Fast Food",
};

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  geojson: "GeoJSON (.geojson)",
};

// ── Cities ───────────────────────────────────────────────────────────────────

export const boundingBoxSchema = z.object({
  south: z.number(),
  north: z.number(),
  west: z.number(),
  east: z.number(),
});

export const citySchema = z.object({
  name: z.string().max(2000),
  display_name: z.string().max(2000),
  latitude: z.number(),
  longitude: z.number(),
  country: z.string().nullish(),
  country_code: z.string().nullish(),
  type: z.string().nullish(),
  bounding_box: boundingBoxSchema.nullish(),
});

export const citySearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(citySchema),
});

export type BoundingBox = z.infer<typeof boundingBoxSchema>;
export type City = z.infer<typeof citySchema>;
export type CitySearchResponse = z.infer<typeof citySearchResponseSchema>;

// ── Places ───────────────────────────────────────────────────────────────────

export const addressSchema = z.object({
  house_number: z.string().max(2000).nullish(),
  street: z.string().max(2000).nullish(),
  suburb: z.string().max(2000).nullish(),
  city: z.string().max(2000).nullish(),
  postcode: z.string().max(2000).nullish(),
  /** Server-computed single-line form; `null` when OSM carried no address tags. */
  formatted: z.string().nullish(),
});

export const placeSchema = z.object({
  osm_id: z.string().max(100),
  name: z.string().max(2000),
  amenity: amenityTypeSchema,
  cuisine: z.array(z.string().max(2000)).max(100),
  address: addressSchema,
  phone: z.string().max(2000).nullish(),
  website: z.string().max(2000).nullish(),
  opening_hours: z.string().max(2000).nullish(),
  latitude: z.number(),
  longitude: z.number(),
  /** Server-computed Google Maps link. */
  maps_url: z.string(),
});

export const searchStatsSchema = z.object({
  total: z.number().int(),
  by_amenity: z.record(z.string(), z.number().int()),
  with_phone: z.number().int(),
  with_website: z.number().int(),
  with_opening_hours: z.number().int(),
});

export const searchResponseSchema = z.object({
  city: citySchema,
  radius_km: z.number().int(),
  amenities: z.array(amenityTypeSchema),
  stats: searchStatsSchema,
  places: z.array(placeSchema),
  elapsed_ms: z.number().int(),
});

export type Address = z.infer<typeof addressSchema>;
export type Place = z.infer<typeof placeSchema>;
export type SearchStats = z.infer<typeof searchStatsSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

// ── Requests ─────────────────────────────────────────────────────────────────

/**
 * Body of `POST /places/search`, exactly as the API expects it.
 *
 * `latitude`/`longitude` are all-or-nothing: supplying both searches that point directly and
 * skips geocoding, which is what happens when the user picks an autocomplete suggestion.
 */
export const searchRequestSchema = z.object({
  city: z.string().min(2).max(200),
  radius_km: z.number().int().min(MIN_RADIUS_KM).max(MAX_RADIUS_KM),
  amenities: z.array(amenityTypeSchema).min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const exportRequestSchema = z.object({
  format: exportFormatSchema,
  city_name: z.string().min(1).max(200),
  places: z.array(placeSchema).min(1).max(MAX_EXPORT_ROWS),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;

// ── Form values (UI-local, camelCase) ────────────────────────────────────────

/**
 * The search form's own shape.
 *
 * `selectedCity` holds the suggestion the user picked, or `null` when they typed a name and
 * submitted without choosing one. Keeping the whole `City` rather than a bare coordinate pair
 * means the resolved label is available for display, and there is exactly one thing to clear when
 * the text is edited — so a stale point can never be searched under a newly typed name.
 */
export const searchFormSchema = z.object({
  city: z
    .string()
    .trim()
    .min(MIN_CITY_QUERY_LENGTH, "Enter at least 2 characters.")
    .max(200, "That name is too long."),
  radiusKm: z.number().int().min(MIN_RADIUS_KM).max(MAX_RADIUS_KM),
  amenities: z.array(amenityTypeSchema).min(1, "Choose at least one place type."),
  selectedCity: citySchema.nullable(),
});

export type SearchFormValues = z.infer<typeof searchFormSchema>;

export const DEFAULT_SEARCH_FORM_VALUES: SearchFormValues = {
  city: "",
  radiusKm: DEFAULT_RADIUS_KM,
  amenities: [...AMENITY_TYPES],
  selectedCity: null,
};

/** Translate validated form values into the wire body. The one camelCase↔snake_case seam. */
export function toSearchRequest(values: SearchFormValues): SearchRequest {
  const picked = values.selectedCity;

  return {
    city: values.city.trim(),
    radius_km: values.radiusKm,
    amenities: values.amenities,
    // Sending coordinates skips geocoding entirely. Omitted rather than sent as null: the API
    // rejects a half-supplied pair, and `undefined` fields are dropped by JSON.stringify.
    ...(picked ? { latitude: picked.latitude, longitude: picked.longitude } : {}),
  };
}

// ── Errors ───────────────────────────────────────────────────────────────────

/**
 * The API's error envelope: `{ "error": { "code", "message", "details"? } }`.
 *
 * Every failure the backend raises deliberately carries a stable `code`, so the UI can branch on
 * it without matching on prose.
 */
export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
