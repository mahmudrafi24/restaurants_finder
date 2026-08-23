"use client";

import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlaceExport } from "@/hooks/use-place-export";
import {
  EXPORT_FORMATS,
  EXPORT_FORMAT_LABELS,
  MAX_EXPORT_ROWS,
  type ExportFormat,
  type Place,
} from "@/lib/schemas";

const FORMAT_ICONS: Record<ExportFormat, LucideIcon> = {
  xlsx: FileSpreadsheet,
  csv: FileText,
  geojson: FileJson,
};

const FORMAT_HINTS: Record<ExportFormat, string> = {
  xlsx: "Styled workbook with clickable map links",
  csv: "Plain table, opens anywhere",
  geojson: "Coordinates for mapping tools",
};

interface ExportMenuProps {
  cityName: string;
  /** The rows to write — the caller passes what the user currently sees, filters included. */
  places: readonly Place[];
  /** True when the visible rows are a filtered subset, so the menu can say so. */
  isFiltered?: boolean;
}

/**
 * Download the current rows as a file.
 *
 * The rows are posted back to the API rather than re-scraped: the search already produced them,
 * OpenStreetMap should not be asked twice for the same answer, and rendering server-side keeps the
 * three formats in one place instead of duplicating the xlsx styling in the browser.
 */
export function ExportMenu({ cityName, places, isFiltered = false }: ExportMenuProps) {
  const { exportRows, pendingFormat, isPending } = usePlaceExport();

  const isEmpty = places.length === 0;
  const isTooLarge = places.length > MAX_EXPORT_ROWS;
  const canExport = !isEmpty && !isTooLarge;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" disabled={isEmpty || isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <span className="block font-medium">Download {places.length.toLocaleString()} rows</span>
          <span className="text-muted-foreground block text-xs">
            {isTooLarge
              ? `Over the ${MAX_EXPORT_ROWS.toLocaleString()}-row limit — narrow the search or filter first.`
              : isFiltered
                ? "Matches the filters applied below."
                : `Everything found near ${cityName}.`}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {EXPORT_FORMATS.map((format) => {
          const Icon = FORMAT_ICONS[format];
          const isThisPending = pendingFormat === format;

          return (
            <DropdownMenuItem
              key={format}
              disabled={!canExport || isPending}
              // Files download without navigating, so the menu closing on select is correct.
              onSelect={() => exportRows({ format, cityName, places })}
              className="gap-3 py-2"
            >
              {isThisPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Icon className="size-4" aria-hidden />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{EXPORT_FORMAT_LABELS[format]}</span>
                <span className="text-muted-foreground text-xs">{FORMAT_HINTS[format]}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
