"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AMENITY_LABELS, AMENITY_TYPES, type AmenityType } from "@/lib/schemas";

interface AmenityFilterProps {
  value: readonly AmenityType[];
  onChange: (value: AmenityType[]) => void;
  disabled?: boolean;
}

/**
 * Which OSM `amenity` values to collect.
 *
 * The options come from `AMENITY_TYPES`, which mirrors the backend enum — adding bars or pubs is
 * a one-line change in both places and needs no work here.
 */
export function AmenityFilter({ value, onChange, disabled = false }: AmenityFilterProps) {
  const toggle = (amenity: AmenityType, checked: boolean) => {
    // Preserve the canonical order rather than order-of-clicking, so the request (and therefore
    // the query cache key) is stable regardless of how the user got here.
    onChange(
      AMENITY_TYPES.filter((candidate) =>
        candidate === amenity ? checked : value.includes(candidate),
      ),
    );
  };

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium">Place types</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {AMENITY_TYPES.map((amenity) => {
          const id = `amenity-${amenity}`;
          return (
            <div key={amenity} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={value.includes(amenity)}
                onCheckedChange={(checked) => toggle(amenity, checked === true)}
                disabled={disabled}
              />
              <Label htmlFor={id} className="cursor-pointer font-normal">
                {AMENITY_LABELS[amenity]}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
