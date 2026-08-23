"use client";

import { AlertOctagon, RotateCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary.
 *
 * Catches render-time failures inside the page. Data-fetching failures are handled far more
 * specifically by `SearchError`, so anything arriving here is a genuine bug — the copy says so
 * rather than pretending the user did something wrong.
 */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production Next strips the message and leaves only `digest`; logging it here is what makes
    // a report traceable to a specific server-side occurrence.
    console.error("Unhandled page error", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
      <AlertOctagon className="text-destructive size-8" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Something broke</h1>
      <p className="text-muted-foreground text-sm text-pretty">
        This page hit an unexpected error. Retrying usually works; if it does not, reload the page.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground font-mono text-xs">Reference: {error.digest}</p>
      ) : null}
      <Button onClick={reset} className="mt-2">
        <RotateCw className="size-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}
