/** Public API client. Transport, response validation and error types live in focused modules. */
import type { z } from "zod";

import { parseFilename, readValidatedJson } from "@/lib/api/response";
import { send, type TransportOptions } from "@/lib/api/transport";

// Preserve the existing imports used by hooks, query configuration and feature code.
export { ApiError, CLIENT_ERROR_CODES, isApiError } from "@/lib/api/error";
export { SEARCH_TIMEOUT_MS } from "@/lib/api/transport";

interface RequestOptions<TSchema extends z.ZodType> extends TransportOptions {
  schema: TSchema;
}

export function apiRequest<TSchema extends z.ZodType>({
  schema,
  ...options
}: RequestOptions<TSchema>): Promise<z.infer<TSchema>> {
  return send({ ...options, read: (response) => readValidatedJson(response, schema) });
}

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

interface DownloadOptions extends Omit<TransportOptions, "method" | "query"> {
  body: unknown;
  fallbackFilename: string;
}

export function apiDownload({
  fallbackFilename,
  ...options
}: DownloadOptions): Promise<DownloadedFile> {
  return send({
    ...options,
    method: "POST",
    read: async (response) => ({
      blob: await response.blob(),
      filename: parseFilename(response.headers.get("Content-Disposition")) ?? fallbackFilename,
    }),
  });
}
