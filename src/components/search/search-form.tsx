"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Search } from "lucide-react";
import { useId } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { AmenityFilter } from "@/components/search/amenity-filter";
import { CityCombobox } from "@/components/search/city-combobox";
import { RadiusSlider } from "@/components/search/radius-slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DEFAULT_SEARCH_FORM_VALUES,
  searchFormSchema,
  toSearchRequest,
  type SearchFormValues,
  type SearchRequest,
} from "@/lib/schemas";

interface SearchFormProps {
  onSearch: (request: SearchRequest) => void;
  isSearching: boolean;
}

/**
 * The search form.
 *
 * Every control is a custom component rather than a native input, so each is bound through
 * `Controller` — the field object it hands down is the whole contract, which keeps this component
 * free of manual value/error plumbing. `useWatch` is used for the one genuine cross-field
 * dependency (the picked city), rather than `watch()`, which subscribes to everything and returns
 * an unmemoisable function.
 */
export function SearchForm({ onSearch, isSearching }: SearchFormProps) {
  const cityInputId = useId();
  const cityHintId = useId();

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: DEFAULT_SEARCH_FORM_VALUES,
  });

  const selectedCity = useWatch({ control, name: "selectedCity" });

  const submit = handleSubmit((values) => onSearch(toSearchRequest(values)));

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} noValidate className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor={cityInputId} className="text-sm font-medium">
              City
            </Label>

            <Controller
              control={control}
              name="city"
              render={({ field }) => (
                <CityCombobox
                  inputId={cityInputId}
                  value={field.value}
                  selected={selectedCity}
                  onValueChange={(next) => {
                    field.onChange(next);
                    // Any edit invalidates a previously picked suggestion — otherwise the search
                    // would use the old coordinates while displaying the newly typed name.
                    if (selectedCity !== null) {
                      setValue("selectedCity", null);
                    }
                  }}
                  onSelect={(city) => {
                    field.onChange(city.name);
                    setValue("selectedCity", city);
                  }}
                  onSubmitRequested={() => void submit()}
                  disabled={isSearching}
                  invalid={Boolean(errors.city)}
                  describedBy={cityHintId}
                />
              )}
            />

            <p
              id={cityHintId}
              className={errors.city ? "text-destructive text-sm" : "text-muted-foreground text-sm"}
              aria-live="polite"
            >
              {errors.city?.message ??
                selectedCity?.display_name ??
                "Pick a suggestion to search an exact location, or type a name and search."}
            </p>
          </div>

          <Separator />

          <div className="grid gap-6 sm:grid-cols-2">
            <Controller
              control={control}
              name="radiusKm"
              render={({ field }) => (
                <RadiusSlider
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSearching}
                />
              )}
            />

            <Controller
              control={control}
              name="amenities"
              render={({ field }) => (
                <div className="space-y-2">
                  <AmenityFilter
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isSearching}
                  />
                  {errors.amenities ? (
                    <p className="text-destructive text-sm" aria-live="polite">
                      {errors.amenities.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
          </div>

          <Button type="submit" size="lg" disabled={isSearching} className="w-full sm:w-auto">
            {isSearching ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Searching…
              </>
            ) : (
              <>
                <Search className="size-4" aria-hidden />
                Search places
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
