"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Globe, Phone } from "lucide-react";
import type { Column, ColumnDef, FilterFn } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AMENITY_LABELS, type AmenityType, type Place } from "@/lib/schemas";

/** Shown wherever OpenStreetMap carried no value. Matches the exporters' `N/A` in spirit. */
const EMPTY = "—";

const AMENITY_BADGE_VARIANT: Record<AmenityType, "default" | "secondary" | "outline"> = {
  cafe: "default",
  restaurant: "secondary",
  fast_food: "outline",
};

function SortableHeader({ column, label }: { column: Column<Place, unknown>; label: string }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="data-[state=open]:bg-accent -ml-2 h-8"
    >
      {label}
      <Icon className={sorted ? "size-3.5" : "size-3.5 opacity-50"} aria-hidden />
      <span className="sr-only">
        {sorted === "asc" ? "sorted ascending" : sorted === "desc" ? "sorted descending" : "sort"}
      </span>
    </Button>
  );
}

/**
 * Free-text filter across every field a person might reasonably search by.
 *
 * TanStack runs the global filter once per globally-filterable column, so every column except
 * `name` sets `enableGlobalFilter: false`. This function then reads `row.original` directly and
 * runs exactly once per row, rather than N identical times.
 */
export const placeGlobalFilter: FilterFn<Place> = (row, _columnId, filterValue) => {
  const needle = String(filterValue).trim().toLowerCase();
  if (!needle) return true;

  const place = row.original;
  const haystack = [
    place.name,
    AMENITY_LABELS[place.amenity],
    place.cuisine.join(" "),
    place.address.formatted,
    place.address.street,
    place.address.suburb,
    place.address.city,
    place.address.postcode,
    place.phone,
    place.website,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
};

/** Strip the scheme and any `www.` so a website column stays readable at narrow widths. */
function prettyHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    // OSM `website` tags are user-entered and frequently not valid URLs.
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

export const placeColumns: ColumnDef<Place>[] = [
  {
    id: "name",
    accessorFn: (place) => place.name,
    header: ({ column }) => <SortableHeader column={column} label="Name" />,
    cell: ({ row }) => (
      <span className="block max-w-[22rem] truncate font-medium" title={row.original.name}>
        {row.original.name}
      </span>
    ),
    // The one column that participates in global filtering — see `placeGlobalFilter`.
    enableGlobalFilter: true,
  },
  {
    id: "amenity",
    accessorFn: (place) => AMENITY_LABELS[place.amenity],
    header: ({ column }) => <SortableHeader column={column} label="Type" />,
    cell: ({ row }) => (
      <Badge variant={AMENITY_BADGE_VARIANT[row.original.amenity]} className="whitespace-nowrap">
        {AMENITY_LABELS[row.original.amenity]}
      </Badge>
    ),
    filterFn: "arrIncludesSome",
    enableGlobalFilter: false,
  },
  {
    id: "cuisine",
    accessorFn: (place) => place.cuisine.join(", "),
    header: "Cuisine",
    cell: ({ row }) => {
      const { cuisine } = row.original;
      if (cuisine.length === 0) return <span className="text-muted-foreground">{EMPTY}</span>;

      return (
        <span className="block max-w-[14rem] truncate capitalize" title={cuisine.join(", ")}>
          {cuisine.join(", ").replace(/_/g, " ")}
        </span>
      );
    },
    enableSorting: false,
    enableGlobalFilter: false,
  },
  {
    id: "address",
    accessorFn: (place) => place.address.formatted ?? "",
    header: ({ column }) => <SortableHeader column={column} label="Address" />,
    cell: ({ row }) => {
      const formatted = row.original.address.formatted;
      if (!formatted) return <span className="text-muted-foreground">{EMPTY}</span>;

      return (
        <span className="block max-w-[24rem] truncate" title={formatted}>
          {formatted}
        </span>
      );
    },
    enableGlobalFilter: false,
  },
  {
    id: "phone",
    accessorFn: (place) => place.phone ?? "",
    header: "Phone",
    cell: ({ row }) => {
      const phone = row.original.phone;
      if (!phone) return <span className="text-muted-foreground">{EMPTY}</span>;

      return (
        <a
          href={`tel:${phone.replace(/\s+/g, "")}`}
          className="hover:text-primary inline-flex items-center gap-1.5 whitespace-nowrap underline-offset-4 hover:underline"
        >
          <Phone className="size-3.5 shrink-0" aria-hidden />
          {phone}
        </a>
      );
    },
    enableSorting: false,
    enableGlobalFilter: false,
  },
  {
    id: "website",
    accessorFn: (place) => place.website ?? "",
    header: "Website",
    cell: ({ row }) => {
      const website = row.original.website;
      if (!website) return <span className="text-muted-foreground">{EMPTY}</span>;

      return (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="hover:text-primary inline-flex max-w-[12rem] items-center gap-1.5 underline-offset-4 hover:underline"
          title={website}
        >
          <Globe className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{prettyHost(website)}</span>
        </a>
      );
    },
    enableSorting: false,
    enableGlobalFilter: false,
  },
  {
    id: "opening_hours",
    accessorFn: (place) => place.opening_hours ?? "",
    header: "Opening hours",
    cell: ({ row }) => {
      const hours = row.original.opening_hours;
      if (!hours) return <span className="text-muted-foreground">{EMPTY}</span>;

      return (
        <span className="block max-w-[16rem] truncate font-mono text-xs" title={hours}>
          {hours}
        </span>
      );
    },
    enableSorting: false,
    enableGlobalFilter: false,
  },
  {
    id: "maps",
    header: () => <span className="sr-only">Map link</span>,
    cell: ({ row }) => (
      <a
        href={row.original.maps_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
      >
        Map
        <ExternalLink className="size-3" aria-hidden />
      </a>
    ),
    enableSorting: false,
    enableHiding: false,
    enableGlobalFilter: false,
  },
];

/** Human labels for the column-visibility menu, which otherwise shows raw ids. */
export const COLUMN_LABELS: Record<string, string> = {
  name: "Name",
  amenity: "Type",
  cuisine: "Cuisine",
  address: "Address",
  phone: "Phone",
  website: "Website",
  opening_hours: "Opening hours",
  maps: "Map link",
};
