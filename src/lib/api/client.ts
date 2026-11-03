/**
 * Typed HTTP client for the Restaurant Scraper API.
 *
 * Every network call in the app goes through this module. That is the point: it is the single
 * seam where the transport can change without touching feature code. Today the browser talks to
 * the FastAPI service directly (CORS allow-list); introducing a Next.js route-handler proxy later
 * — for auth, or to hide the API origin — means changing `resolveUrl` here and nothing else.
 *
 * Responsibilities:
 *   • prefix and normalise URLs
 *   • enforce a timeout, and compose it with any caller-supplied `AbortSignal`
 *   • collapse every failure mode — HTTP error, network error, timeout, malformed body — into a
 *     single `ApiError` carrying a stable `code`
 *   • validate successful responses against a zod schema before handing them to callers
 */
import type { z } from "zod";

import { env } from "@/lib/env";
import { apiErrorEnvelopeSchema } from "@/lib/schemas";

/** Requests that only read data; comfortably longer than any expected round trip. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Ceiling for a place search.
 *
 * The backend enforces a total 55s request deadline before its 60s function limit, so
 * the server produces a proper `504` envelope before this fires. This exists only to bound a
 * connection that has gone silent — a hung socket, not a slow query.
 */
export const SEARCH_TIMEOUT_MS = 70_000;

/** Error codes this client generates itself, distinct from those the API returns. */
export const CLIENT_ERROR_CODES = {
  network: "network_error",
  timeout: "client_timeout",
  malformedResponse: "malformed_response",
} as const;

/**
 * A failed API call.
 *
 * `code` is the value to branch on. Codes originating from the backend are defined in
 * `app/core/errors.py` (`city_not_found`, `upstream_timeout`, `upstream_rate_limited`,
 * `upstream_unavailable`, `validation_error`, `export_too_large`, …); the client adds the three
 * in `CLIENT_ERROR_CODES`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    message: string,
    options: { status: number; code: string; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details ?? {};
  }

  /**
   * Whether retrying the identical request could plausibly succeed.
   *
   * Used to drive TanStack Query's retry decision. A `404` for a city that does not exist or a
   * `422` for a malformed body will fail the same way forever; a rate limit or a flaky upstream
   * will not.
   */
  get isRetryable(): boolean {
    if (this.status === 429 || this.status >= 500) return true;
    return this.code === CLIENT_ERROR_CODES.network;
  }

  /** Seconds the upstream asked us to wait, when it said so. */
  get retryAfterSeconds(): number | null {
    const value = this.details.retry_after_seconds;
    return typeof value === "number" ? value : null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

interface RequestOptions<TSchema extends z.ZodType> {
  path: string;
  /** Schema the successful response body must satisfy. */
  schema: TSchema;
  method?: "GET" | "POST";
  /** Serialised as JSON. Omit for GET. */
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Issue a request and return its parsed, schema-validated body. */
export async function apiRequest<TSchema extends z.ZodType>({
  path,
  schema,
  method = "GET",
  body,
  query,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RequestOptions<TSchema>): Promise<z.infer<TSchema>> {
  return send({
    path,
    method,
    body,
    query,
    signal,
    timeoutMs,
    read: async (response) => {
      if (!response.ok) {
        throw await toApiError(response);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new ApiError("The server returned a response that could not be read.", {
          status: response.status,
          code: CLIENT_ERROR_CODES.malformedResponse,
        });
      }

      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        // A schema mismatch means the frontend and backend contracts have drifted. Surfacing it as a
        // distinct code makes that diagnosable instead of looking like a random rendering bug.
        throw new ApiError(
          "The server's response did not match the expected format. The API may have changed.",
          {
            status: response.status,
            code: CLIENT_ERROR_CODES.malformedResponse,
            details: { issues: parsed.error.issues.map((issue) => issue.path.join(".")) },
          },
        );
      }

      return parsed.data;
    },
  });
}

export interface DownloadedFile {
  blob: Blob;
  /** Filename the server chose, from `Content-Disposition`. */
  filename: string;
}

/**
 * Issue a request whose response is a file rather than JSON.
 *
 * Reading the filename requires the API to send `Access-Control-Expose-Headers:
 * Content-Disposition` — the browser hides every other response header on a cross-origin fetch.
 * `fallbackFilename` covers the case where that header is missing or unparsable.
 */
export async function apiDownload({
  path,
  body,
  fallbackFilename,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  path: string;
  body: unknown;
  fallbackFilename: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<DownloadedFile> {
  return send({
    path,
    method: "POST",
    body,
    signal,
    timeoutMs,
    read: async (response) => {
      if (!response.ok) {
        throw await toApiError(response);
      }

      return {
        blob: await response.blob(),
        filename: parseFilename(response.headers.get("Content-Disposition")) ?? fallbackFilename,
      };
    },
  });
}

// ── Internals ────────────────────────────────────────────────────────────────

async function send<T>({
  path,
  method,
  body,
  query,
  signal,
  timeoutMs,
  read,
}: {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  timeoutMs: number;
  read: (response: Response) => Promise<T>;
}): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  // Compose so that either the caller cancelling (unmount, superseded query) or the timeout
  // aborts the request. Without this the caller's signal would be ignored.
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const response = await fetch(resolveUrl(path, query), {
      method,
      // `Content-Type` alone keeps the CORS preflight to what the API allow-lists. Adding other
      // headers here requires updating `allow_headers` in the backend's CORS middleware.
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: composed,
      // No cookies are used; keeping this explicit documents that and avoids the stricter CORS
      // rules that credentialed requests bring.
      credentials: "omit",
      cache: "no-store",
    });
    return await read(response);
  } catch (error) {
    // A caller-initiated abort must propagate untouched so TanStack Query treats it as a
    // cancellation rather than a failure worth retrying or reporting.
    if (signal?.aborted) throw error;

    if (timeout.aborted) {
      throw new ApiError("The request took too long and was cancelled. Try a smaller radius.", {
        status: 408,
        code: CLIENT_ERROR_CODES.timeout,
      });
    }

    if (error instanceof ApiError) throw error;

    throw new ApiError(
      "Could not reach the server. Check your connection and that the API is running.",
      { status: 0, code: CLIENT_ERROR_CODES.network },
    );
  }
}

function resolveUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(`${env.NEXT_PUBLIC_API_URL}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return url.toString();
}

/**
 * Turn an error response into an `ApiError`.
 *
 * The API always answers with its own envelope, but an infrastructure failure between us and it
 * (a gateway, a cold-start crash) can return HTML or nothing at all — hence the fallbacks.
 */
async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return new ApiError(genericMessageFor(response.status), {
      status: response.status,
      code: `http_${response.status}`,
    });
  }

  const parsed = apiErrorEnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    return new ApiError(genericMessageFor(response.status), {
      status: response.status,
      code: `http_${response.status}`,
    });
  }

  const { code, message, details } = parsed.data.error;
  return new ApiError(message, { status: response.status, code, details });
}

function genericMessageFor(status: number): string {
  if (status === 404) return "Not found.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The server is having trouble. Please try again shortly.";
  return `The request failed (HTTP ${status}).`;
}

/**
 * Extract the filename from a `Content-Disposition` header.
 *
 * The API sends both forms; RFC 5987's `filename*` is preferred because it survives non-ASCII
 * city names such as `zürich_cafes_restaurants.xlsx`.
 */
function parseFilename(header: string | null): string | null {
  if (!header) return null;

  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // Malformed percent-encoding; fall through to the plain form.
    }
  }

  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}
