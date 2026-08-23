/**
 * Environment configuration, validated once at module load.
 *
 * Importing this module instead of reading `process.env` directly means a missing or malformed
 * variable fails the build with a readable message, rather than surfacing later as a request to
 * `undefined/api/v1/places/search`.
 *
 * Only `NEXT_PUBLIC_*` variables belong here: this module is imported by client components, so
 * anything added must be safe to ship to the browser. Server-only secrets need a separate
 * module that is never imported from a `"use client"` file.
 */
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .url("NEXT_PUBLIC_API_URL must be an absolute URL, e.g. http://127.0.0.1:8000")
    // Paths are joined as `${base}/api/v1/...`, so a trailing slash would produce a double
    // slash. Normalising here keeps every call site from having to care.
    .transform((value) => value.replace(/\/+$/, "")),
});

const parsed = envSchema.safeParse({
  // Must be referenced as a static property for Next.js to inline the value at build time —
  // `process.env[key]` is not substituted and would be `undefined` in the browser.
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Invalid environment configuration:\n${problems}\n\n` +
      "Copy .env.example to .env.local and fill in the values.",
  );
}

export const env = parsed.data;
