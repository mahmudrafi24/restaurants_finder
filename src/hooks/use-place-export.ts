"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { exportPlaces } from "@/lib/api/places";
import { saveBlob } from "@/lib/download";
import { presentError } from "@/lib/errors";
import { EXPORT_FORMAT_LABELS, type ExportFormat, type Place } from "@/lib/schemas";

interface ExportVariables {
  format: ExportFormat;
  cityName: string;
  places: readonly Place[];
}

/**
 * Render the current rows into a file and hand it to the browser.
 *
 * A mutation rather than a query: it is an explicit user action with a side effect, must not be
 * cached, and must not be retried behind the user's back.
 */
export function usePlaceExport() {
  const mutation = useMutation({
    mutationFn: (variables: ExportVariables) => exportPlaces(variables),
    onSuccess: ({ blob, filename }, { format, places }) => {
      saveBlob(blob, filename);
      toast.success(`Downloaded ${EXPORT_FORMAT_LABELS[format]}`, {
        description: `${filename} · ${places.length.toLocaleString()} rows`,
      });
    },
    onError: (error) => {
      const { title, description, hint } = presentError(error);
      toast.error(title, { description: hint ? `${description} ${hint}` : description });
    },
  });

  return {
    exportRows: mutation.mutate,
    /** The format currently downloading, so only that menu item shows a spinner. */
    pendingFormat: mutation.isPending ? (mutation.variables?.format ?? null) : null,
    isPending: mutation.isPending,
  };
}
