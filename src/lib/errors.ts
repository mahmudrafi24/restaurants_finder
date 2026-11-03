/**
 * Turning failures into something a user can act on.
 *
 * The API attaches a stable `code` to every error precisely so the UI does not have to match on
 * prose. The messages the backend sends are already user-facing and specific ("Dense cities can
 * exceed the time limit — try a smaller radius"), so they are shown as-is; what is added here is
 * a short title and, where one exists, a concrete next step.
 */
import { isApiError } from "@/lib/api/client";

export interface PresentedError {
  title: string;
  description: string;
  /** A suggested remedy, when the failure has an obvious one. */
  hint?: string;
  /** Whether offering a "try again" affordance makes sense. */
  retryable: boolean;
}

const FALLBACK: PresentedError = {
  title: "Something went wrong",
  description: "An unexpected error occurred. Please try again.",
  retryable: true,
};

export function presentError(error: unknown): PresentedError {
  if (!isApiError(error)) {
    return error instanceof Error ? { ...FALLBACK, description: error.message } : FALLBACK;
  }

  const base = { description: error.message, retryable: error.isRetryable };

  switch (error.code) {
    case "city_not_found":
      return {
        ...base,
        title: "City not found",
        hint: "Check the spelling, or pick a suggestion from the list as you type.",
      };

    case "upstream_timeout":
    case "client_timeout":
      return {
        ...base,
        title: "The search timed out",
        hint: "Large radii in dense cities can exceed the time limit. Try 10 km or less.",
        retryable: true,
      };

    case "upstream_rate_limited": {
      const seconds = error.retryAfterSeconds;
      return {
        ...base,
        title: "Rate limited",
        hint:
          seconds === null
            ? "The OpenStreetMap services are throttling requests. Wait a moment and retry."
            : `Wait about ${Math.ceil(seconds)} seconds and try again.`,
      };
    }

    case "upstream_unavailable":
      return {
        ...base,
        title: "Data provider unavailable",
        hint: "This is usually brief — the OpenStreetMap servers are volunteer-run.",
      };

    case "network_error":
      return {
        ...base,
        title: "Cannot reach the server",
        hint: "Check your connection. If you are running locally, confirm the API is started.",
      };

    case "malformed_response":
      return {
        ...base,
        title: "Unexpected response",
        hint: "The frontend and API versions may not match.",
      };

    case "request_too_large":
      return {
        ...base,
        title: "Export is too large",
        hint: "Filter the results to download fewer rows.",
        retryable: false,
      };

    case "rate_limited":
      return { ...base, title: "Too many requests", hint: "Wait a minute before trying again." };

    case "server_busy":
      return { ...base, title: "Server busy", hint: "Wait a moment and try again." };

    case "export_too_large":
      return {
        ...base,
        title: "Too many rows to export",
        hint: "Filter the table or reduce the radius, then export again.",
        retryable: false,
      };

    case "validation_error":
      return { ...base, title: "Invalid search", retryable: false };

    default:
      return { ...base, title: "Search failed" };
  }
}
