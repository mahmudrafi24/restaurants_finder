"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SearchX } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";

import { placeColumns, placeGlobalFilter } from "@/components/results/columns";
import { ResultsToolbar } from "@/components/results/results-toolbar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Place } from "@/lib/schemas";

const PAGE_SIZES = [25, 50, 100, 250] as const;
const DEFAULT_PAGE_SIZE = 50;

interface ResultsTableProps {
  places: Place[];
  cityName: string;
}

/**
 * Sortable, filterable, paginated view of a search result.
 *
 * All client-side: a dense city returns a few thousand rows, which is well within what the browser
 * can sort and filter instantly, and it means filtering never costs another Overpass query. Rows
 * are paginated rather than virtualised — pagination also bounds the DOM, and it gives the export
 * menu a stable "what you see" set without a scroll position to reason about.
 */
export function ResultsTable({ places, cityName }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  // TanStack Table v8 predates the React Compiler: `useReactTable` returns fresh closures on every
  // render, so the compiler declines to optimise this component. That costs nothing here — none of
  // those closures are handed to a memoised child, and the compiler is not enabled in
  // `next.config.ts` — but the rule cannot know that. Revisit with react-table v9.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: places,
    columns: placeColumns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: placeGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
    // Row identity survives sorting and filtering, so React reuses DOM instead of rebuilding it.
    getRowId: (place) => place.osm_id,
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const firstRow = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, filteredCount);

  return (
    <div className="space-y-4">
      <ResultsToolbar table={table} cityName={cityName} />

      <div className="overflow-hidden rounded-xl border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={table.getVisibleFlatColumns().length}
                    className="h-40 text-center"
                  >
                    <span className="text-muted-foreground flex flex-col items-center gap-2">
                      <SearchX className="size-6" aria-hidden />
                      <span className="text-sm">No rows match this filter.</span>
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between">
        <p className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
          {filteredCount === 0
            ? "No rows"
            : `Showing ${firstRow.toLocaleString()}–${lastRow.toLocaleString()} of ${filteredCount.toLocaleString()}`}
        </p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm whitespace-nowrap">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>

            <span className="text-muted-foreground px-2 text-sm whitespace-nowrap tabular-nums">
              Page {(pageIndex + 1).toLocaleString()} of{" "}
              {Math.max(table.getPageCount(), 1).toLocaleString()}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
