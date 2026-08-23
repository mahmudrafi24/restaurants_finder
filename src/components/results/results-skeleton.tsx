"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const TILE_COUNT = 4;
const ROW_COUNT = 8;

/**
 * Placeholder shown while a search is in flight.
 *
 * Mirrors the real layout — four stat tiles, a toolbar row, a table — so the page does not jump
 * when the data lands. A dense city takes about ten seconds, which is far too long for a bare
 * spinner.
 */
export function ResultsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Searching for places…</span>

      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: TILE_COUNT }, (_, index) => (
            <Card key={index} className="shadow-none">
              <CardContent className="flex items-start gap-3 p-4">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-full max-w-xs" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="bg-muted/50 h-10 border-b" />
          {Array.from({ length: ROW_COUNT }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-1/5" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
