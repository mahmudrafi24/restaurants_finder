"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Loader2, MapPin, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";
import { useCitySuggestions } from "@/hooks/use-city-suggestions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { selectableCitySuggestions, shouldSubmitCityOnEnter } from "@/lib/city-suggestions";
import { MIN_CITY_QUERY_LENGTH, type City } from "@/lib/schemas";

/**
 * Delay before a keystroke turns into a request.
 *
 * 300 ms is short enough to feel immediate and long enough that typing "Hamburg" costs one
 * request rather than seven — which matters because the suggestion upstream is donated
 * OpenStreetMap infrastructure with a fair-use policy.
 */
const DEBOUNCE_MS = 300;

interface CityComboboxProps {
  /** The text currently in the field. */
  value: string;
  /** The suggestion the user picked, if any. */
  selected: City | null;
  /** Called as the user types. The parent should clear `selected` in response. */
  onValueChange: (value: string) => void;
  /** Called when a suggestion is chosen. */
  onSelect: (city: City) => void;
  onSubmitRequested?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  inputId?: string;
}

/**
 * City field with server-driven autocomplete.
 *
 * Deliberately not the stock shadcn combobox (a button that opens a popover): a city field should
 * be typed into directly, and the popover pattern fights the input for focus. This uses cmdk
 * inline — the input is always the focused element and the list floats beneath it.
 *
 * Filtering is off (`shouldFilter={false}`). The results are already ranked by the geocoder, and
 * cmdk's built-in fuzzy filter would re-order or discard them: a search for "hambu" legitimately
 * returns "Hamburg", which a naive substring filter would keep but a scoring filter may rank
 * below a worse match.
 */
export function CityCombobox({
  value,
  selected,
  onValueChange,
  onSelect,
  onSubmitRequested,
  disabled = false,
  invalid = false,
  describedBy,
  inputId,
}: CityComboboxProps) {
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const id = inputId ?? generatedId;

  const debouncedValue = useDebouncedValue(value, DEBOUNCE_MS);

  // Once a suggestion is chosen the field holds its exact name, which would otherwise trigger a
  // fresh lookup for a question already answered.
  const shouldQuery = open && selected === null;
  const {
    data: querySuggestions = [],
    isFetching,
    isError,
  } = useCitySuggestions(debouncedValue, { enabled: shouldQuery });

  const isTooShort = value.trim().length < MIN_CITY_QUERY_LENGTH;
  // While the debounce is still pending, `suggestions` describes the previous query. Saying "no
  // matches" at that moment would be wrong.
  const isSettled = debouncedValue.trim() === value.trim() && !isFetching;

  const suggestions = selectableCitySuggestions({
    value,
    query: debouncedValue,
    suggestions: querySuggestions,
    isFetching,
    isError,
  });
  const showList = open && !isTooShort && selected === null;

  const emptyMessage = useMemo(() => {
    if (isError) return "Suggestions are unavailable right now — you can still search by name.";
    if (!isSettled) return "Searching…";
    return "No matching places. Try a different spelling.";
  }, [isError, isSettled]);

  return (
    <Command
      shouldFilter={false}
      loop
      // The root must not clip the floating list, and must not paint a panel of its own — only
      // the dropdown below is a surface.
      className="relative overflow-visible bg-transparent p-0"
    >
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <CommandPrimitive.Input
          id={id}
          value={value}
          onValueChange={(next) => {
            onValueChange(next);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            // An empty/loading/error list has no item cmdk can select. Submit the typed
            // name instead, while preserving IME composition and normal item selection.
            if (
              shouldSubmitCityOnEnter({
                key: event.key,
                isComposing: event.nativeEvent.isComposing || event.keyCode === 229,
                showList,
                suggestionCount: suggestions.length,
              })
            ) {
              event.preventDefault();
              event.stopPropagation();
              onSubmitRequested?.();
            }
          }}
          disabled={disabled}
          placeholder="Start typing a city — e.g. Hamburg"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          autoComplete="off"
          className={cn(
            "border-input bg-background ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:ring-ring flex h-11 w-full rounded-lg border py-2 pr-10 pl-9 text-base",
            "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            invalid && "border-destructive focus-visible:ring-destructive",
          )}
        />
        {isFetching ? (
          <Loader2
            className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        ) : selected ? (
          <MapPin
            className="text-primary absolute top-1/2 right-3 size-4 -translate-y-1/2"
            aria-hidden
          />
        ) : null}
      </div>

      {showList ? (
        <div
          // Without this, the input's blur fires before the item's click and the dropdown closes
          // before a selection can register.
          onMouseDown={(event) => event.preventDefault()}
          className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border shadow-lg"
        >
          <CommandList className="max-h-72">
            {suggestions.length === 0 ? (
              <CommandEmpty className="text-muted-foreground py-6 text-sm">
                {emptyMessage}
              </CommandEmpty>
            ) : (
              suggestions.map((city) => (
                <CommandItem
                  // `display_name` alone is not unique across geocoders; the coordinates make it so.
                  key={`${city.display_name}:${city.latitude},${city.longitude}`}
                  value={`${city.display_name}:${city.latitude},${city.longitude}`}
                  onSelect={() => {
                    onSelect(city);
                    setOpen(false);
                  }}
                  className="flex items-start gap-2 py-2"
                >
                  <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{city.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {city.display_name}
                    </span>
                  </span>
                  {city.type ? (
                    <span className="text-muted-foreground mt-0.5 shrink-0 text-xs capitalize">
                      {city.type.replace(/_/g, " ")}
                    </span>
                  ) : null}
                </CommandItem>
              ))
            )}
          </CommandList>
        </div>
      ) : null}
    </Command>
  );
}
