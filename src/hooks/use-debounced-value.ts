"use client";

import { useEffect, useState } from "react";

/**
 * Return `value` after it has stopped changing for `delayMs`.
 *
 * Used to throttle the city autocomplete. This is not only a performance measure: the suggestion
 * upstream runs on donated OpenStreetMap infrastructure, and firing a request per keystroke is
 * the kind of traffic that gets an application blocked.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
