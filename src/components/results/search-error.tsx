"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { presentError } from "@/lib/errors";

interface SearchErrorProps {
  error: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
}

/**
 * Failure state for a search.
 *
 * Every message comes from `presentError`, which branches on the API's machine-readable `code`
 * rather than on wording — so a copy change on the backend cannot silently break the UI, and a
 * timeout is never presented as if the city did not exist.
 */
export function SearchError({ error, onRetry, isRetrying = false }: SearchErrorProps) {
  const { title, description, hint, retryable } = presentError(error);

  return (
    <Alert variant="destructive" className="p-4">
      <AlertTriangle aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {description}
          {hint ? <span className="text-muted-foreground block">{hint}</span> : null}
        </p>

        {retryable && onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
            <RotateCw className={isRetrying ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
