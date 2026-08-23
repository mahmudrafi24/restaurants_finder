"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import type { Table } from "@tanstack/react-table";

import { COLUMN_LABELS } from "@/components/results/columns";
import { ExportMenu } from "@/components/results/export-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Place } from "@/lib/schemas";

interface ResultsToolbarProps {
  table: Table<Place>;
  cityName: string;
}

/**
 * Filter, column and export controls for the results table.
 *
 * Takes the table instance rather than lifting its state: the filter box, the row count and the
 * export selection all describe the same view, and threading them through props would mean keeping
 * three things in sync that TanStack already keeps in one.
 */
export function ResultsToolbar({ table, cityName }: ResultsToolbarProps) {
  const globalFilter = String(table.getState().globalFilter ?? "");
  const totalRows = table.getCoreRowModel().rows.length;

  // Post-filter, post-sort, pre-pagination: exactly the rows the user is looking at, in the order
  // they are looking at them. Exporting the whole result set while a filter is applied would be
  // surprising.
  const visibleRows = table.getSortedRowModel().rows;
  const isFiltered = visibleRows.length !== totalRows;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={globalFilter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          placeholder="Filter by name, address, cuisine…"
          aria-label="Filter results"
          className="pr-9 pl-9"
        />
        {globalFilter ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => table.setGlobalFilter("")}
            aria-label="Clear filter"
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground hidden text-sm tabular-nums md:inline">
          {isFiltered
            ? `${visibleRows.length.toLocaleString()} of ${totalRows.toLocaleString()}`
            : `${totalRows.toLocaleString()} rows`}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="size-4" aria-hidden />
              <span className="hidden sm:inline">Columns</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) => column.toggleVisibility(checked)}
                  // Keeps the menu open so several columns can be toggled in one pass.
                  onSelect={(event) => event.preventDefault()}
                >
                  {COLUMN_LABELS[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ExportMenu
          cityName={cityName}
          places={visibleRows.map((row) => row.original)}
          isFiltered={isFiltered}
        />
      </div>
    </div>
  );
}
