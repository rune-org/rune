"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a value by ``delay`` milliseconds. Used here to avoid hammering
 * ``GET /templates/`` on every keystroke in the gallery search box.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
