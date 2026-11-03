import type { City } from "@/lib/schemas";

/** Only settled results for the current input can be selected or submitted through cmdk. */
export function selectableCitySuggestions({
  value,
  query,
  suggestions,
  isFetching,
  isError,
}: {
  value: string;
  query: string;
  suggestions: City[];
  isFetching: boolean;
  isError: boolean;
}): City[] {
  return value.trim() === query.trim() && !isFetching && !isError ? suggestions : [];
}

/** Enter submits a typed name when cmdk has no selectable result; leave IME Enter alone. */
export function shouldSubmitCityOnEnter({
  key,
  isComposing,
  showList,
  suggestionCount,
}: {
  key: string;
  isComposing: boolean;
  showList: boolean;
  suggestionCount: number;
}): boolean {
  return key === "Enter" && !isComposing && (!showList || suggestionCount === 0);
}
