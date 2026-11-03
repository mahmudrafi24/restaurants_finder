"use client";

import { Compass } from "lucide-react";
import { useState } from "react";

import { NoResults } from "@/components/results/no-results";
import { ResultStats } from "@/components/results/result-stats";
import { ResultsSkeleton } from "@/components/results/results-skeleton";
import { ResultsTable } from "@/components/results/results-table";
import { SearchError } from "@/components/results/search-error";
import { SearchForm } from "@/components/search/search-form";
import { usePlaceSearch } from "@/hooks/use-place-search";
import type { SearchRequest } from "@/lib/schemas";

function IdleState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <Compass className="text-muted-foreground size-7" aria-hidden />
      <h2 className="text-lg font-semibold">Start with a city</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        Every cafe, restaurant and fast-food place mapped in OpenStreetMap around the city centre —
        with addresses, phone numbers, websites and opening hours where contributors have added
        them. Results are browsable here and downloadable as Excel, CSV or GeoJSON.
      </p>
    </div>
  );
}

/**
 * The search page's stateful core.
 *
 * `submitted` — not the live form values — drives the query. Typing in the form must not fire
 * requests at OpenStreetMap; only pressing Search does. Because the request object is also the
 * query key, re-submitting the same search is served from cache instead of re-scraping.
 */
export function SearchExperience() {
  const [submitted, setSubmitted] = useState<SearchRequest | null>(null);
  const { data, error, isError, isFetching, refetch } = usePlaceSearch(submitted);

  const isSearching = isFetching;
  const showSkeleton = submitted !== null && isFetching && data === undefined;

  return (
    <div className="space-y-8">
      <SearchForm onSearch={setSubmitted} isSearching={isSearching} />

      <section id="results" aria-label="Results">
        {submitted === null ? (
          <IdleState />
        ) : showSkeleton ? (
          <ResultsSkeleton />
        ) : isError ? (
          <SearchError error={error} onRetry={() => void refetch()} isRetrying={isFetching} />
        ) : data ? (
          <div className="space-y-8">
            <ResultStats response={data} />
            {data.places.length === 0 ? (
              <NoResults cityName={data.city.name} radiusKm={data.radius_km} />
            ) : (
              <ResultsTable
                key={JSON.stringify(submitted)}
                places={data.places}
                cityName={data.city.name}
              />
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
