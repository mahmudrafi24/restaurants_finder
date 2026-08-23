"use client";

import { Clock, Globe, MapPin, Phone, Store, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AMENITY_LABELS, type AmenityType, type SearchResponse } from "@/lib/schemas";

interface ResultStatsProps {
  response: SearchResponse;
}

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="bg-muted text-muted-foreground rounded-lg p-2">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="text-muted-foreground block text-xs">{label}</span>
          <span className="block text-xl font-semibold tabular-nums">{value}</span>
          {detail ? <span className="text-muted-foreground block text-xs">{detail}</span> : null}
        </span>
      </CardContent>
    </Card>
  );
}

function share(part: number, total: number): string | undefined {
  if (total === 0) return undefined;
  return `${Math.round((part / total) * 100)}% of results`;
}

function formatElapsed(elapsedMs: number): string {
  return elapsedMs < 1000 ? `${elapsedMs} ms` : `${(elapsedMs / 1000).toFixed(1)} s`;
}

/**
 * Summary of what a search returned.
 *
 * The completeness counts matter more than they look: OpenStreetMap is volunteer-maintained, so
 * "3,942 places but only 1,100 with a phone number" is the honest shape of the data and saves
 * anyone from assuming an empty column is a bug.
 */
export function ResultStats({ response }: ResultStatsProps) {
  const { city, radius_km, stats, elapsed_ms, amenities } = response;

  return (
    <section aria-label="Search summary" className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MapPin className="text-primary size-4 shrink-0" aria-hidden />
          {city.name}
        </h2>
        <span className="text-muted-foreground text-sm">within {radius_km} km</span>
        <span className="text-muted-foreground/60" aria-hidden>
          ·
        </span>
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Timer className="size-3.5" aria-hidden />
          {formatElapsed(elapsed_ms)}
        </span>
      </div>

      <p className="text-muted-foreground text-sm">{city.display_name}</p>

      <div className="flex flex-wrap gap-2">
        {amenities.map((amenity: AmenityType) => (
          <Badge key={amenity} variant="secondary" className="gap-1.5">
            {AMENITY_LABELS[amenity]}
            <span className="tabular-nums opacity-70">
              {(stats.by_amenity[amenity] ?? 0).toLocaleString()}
            </span>
          </Badge>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Store}
          label="Places found"
          value={stats.total.toLocaleString()}
          detail={`${amenities.length} place ${amenities.length === 1 ? "type" : "types"}`}
        />
        <StatTile
          icon={Phone}
          label="With phone"
          value={stats.with_phone.toLocaleString()}
          detail={share(stats.with_phone, stats.total)}
        />
        <StatTile
          icon={Globe}
          label="With website"
          value={stats.with_website.toLocaleString()}
          detail={share(stats.with_website, stats.total)}
        />
        <StatTile
          icon={Clock}
          label="With opening hours"
          value={stats.with_opening_hours.toLocaleString()}
          detail={share(stats.with_opening_hours, stats.total)}
        />
      </div>
    </section>
  );
}
