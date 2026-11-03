/** Request deadlines include both fetching headers and consuming the response body. */
import { ApiError, CLIENT_ERROR_CODES } from "@/lib/api/error";
import { toApiError } from "@/lib/api/response";
import { env } from "@/lib/env";

const DEFAULT_TIMEOUT_MS = 30_000;
/** Above the API's total 55-second deadline and hosting function's 60-second ceiling. */
export const SEARCH_TIMEOUT_MS = 70_000;

export interface TransportOptions {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function send<T>({
  path,
  method = "GET",
  body,
  query,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  read,
}: TransportOptions & { read: (response: Response) => Promise<T> }): Promise<T> {
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
    if (!response.ok) throw await toApiError(response);
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
