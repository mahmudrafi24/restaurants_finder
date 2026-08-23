"use client";

import { MapPinOff } from "lucide-react";

import { MAX_RADIUS_KM } from "@/lib/schemas";

interface NoResultsProps {
  cityName: string;
  radiusKm: number;
}

/**
 * A search that succeeded and found nothing.
 *
 * Distinct from an error on purpose: the request worked, OpenStreetMap simply has no matching
 * places mapped there. That is genuinely common for small or rural places, so the copy points at
 * coverage rather than implying a fault.
 */
export function NoResults({ cityName, radiusKm }: NoResultsProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <MapPinOff className="text-muted-foreground size-7" aria-hidden />
      <h2 className="text-lg font-semibold">No places found near {cityName}</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        Nothing matching those types is mapped within {radiusKm} km. Try widening the radius
        {radiusKm < MAX_RADIUS_KM ? ` (up to ${MAX_RADIUS_KM} km)` : ""}, selecting more place
        types, or searching a nearby larger town — OpenStreetMap coverage is thinner in rural areas.
      </p>
    </div>
  );
}
