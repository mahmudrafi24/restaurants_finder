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
