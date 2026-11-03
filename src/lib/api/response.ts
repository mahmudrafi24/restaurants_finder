/** JSON validation, API error envelopes and download header parsing. */
import type { z } from "zod";

import { ApiError, CLIENT_ERROR_CODES } from "@/lib/api/error";
import { apiErrorEnvelopeSchema } from "@/lib/schemas";

export async function readValidatedJson<TSchema extends z.ZodType>(
  response: Response,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    // Body-read interruptions are handled by transport; only JSON syntax is malformed data.
    if (!(error instanceof SyntaxError)) throw error;
    throw new ApiError("The server returned a response that could not be read.", {
      status: response.status,
      code: CLIENT_ERROR_CODES.malformedResponse,
    });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
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
}

export async function toApiError(response: Response): Promise<ApiError> {
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

/** Prefer the UTF-8 filename parameter, falling back to the plain filename. */
export function parseFilename(header: string | null): string | null {
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
