/**
 * `POST /api/v1/places/search` and `POST /api/v1/places/export`.
 *
 * Export is stateless by design: the client posts back the rows it already received from the
 * search, so Overpass is never queried twice for data the browser is holding. That is why the
 * `Place` objects must round-trip unmodified — see the naming note in `lib/schemas.ts`.
 */
import { apiDownload, apiRequest, SEARCH_TIMEOUT_MS, type DownloadedFile } from "@/lib/api/client";
import {
  searchResponseSchema,
  type ExportFormat,
  type Place,
  type SearchRequest,
  type SearchResponse,
} from "@/lib/schemas";

/** Fetch every matching amenity within the radius. Complete, not paginated. */
export async function searchPlaces(
  request: SearchRequest,
  options: { signal?: AbortSignal } = {},
): Promise<SearchResponse> {
  return apiRequest({
    path: "/api/v1/places/search",
    schema: searchResponseSchema,
    method: "POST",
    body: request,
    signal: options.signal,
    // A dense metro at 25 km can take tens of seconds upstream.
    timeoutMs: SEARCH_TIMEOUT_MS,
  });
}

/** Render rows the client already holds into a downloadable file. */
export async function exportPlaces(
  {
    format,
    cityName,
    places,
  }: {
    format: ExportFormat;
    cityName: string;
    places: readonly Place[];
  },
  options: { signal?: AbortSignal } = {},
): Promise<DownloadedFile> {
  return apiDownload({
    path: "/api/v1/places/export",
    body: { format, city_name: cityName, places },
    fallbackFilename: buildFilename(cityName, format),
    signal: options.signal,
    // Rendering ~4,000 rows to XLSX takes a few seconds; the payload itself is a few hundred KB.
    timeoutMs: SEARCH_TIMEOUT_MS,
  });
}

/**
 * Local copy of the server's naming scheme, used only when `Content-Disposition` is unreadable.
 *
 * Mirrors `build_filename` in `app/services/exporters/base.py`.
 */
export function buildFilename(cityName: string, extension: string): string {
  const slug = cityName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${slug || "results"}_cafes_restaurants.${extension}`;
}
