"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MAX_RADIUS_KM, MIN_RADIUS_KM } from "@/lib/schemas";

/**
 * Radius above which a dense city starts producing thousands of rows and multi-second waits.
 * Used only to decide whether to show a heads-up, not to restrict the choice.
 */
const SLOW_RADIUS_KM = 10;

interface RadiusSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * Search radius around the city centre.
 *
 * This replaces the original CLI's hidden `[5, 8, 12]` retry ladder, which stopped at the first
 * radius that succeeded and therefore never covered more than 5 km on a healthy run. Coverage is
 * now an explicit, visible choice.
 */
export function RadiusSlider({ value, onChange, disabled = false }: RadiusSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="radius" className="text-sm font-medium">
          Search radius
        </Label>
        <span className="text-muted-foreground text-sm tabular-nums">{value} km</span>
      </div>

      <Slider
        id="radius"
        min={MIN_RADIUS_KM}
        max={MAX_RADIUS_KM}
        step={1}
        value={[value]}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
        disabled={disabled}
        aria-label="Search radius in kilometres"
        aria-valuetext={`${value} kilometres`}
      />

      <p className="text-muted-foreground text-xs">
        {value >= SLOW_RADIUS_KM
          ? "Large areas take longer and may time out. Start with 5 km, then expand if needed."
          : `Covers everything within ${value} km of the city centre.`}
      </p>
    </div>
  );
}
