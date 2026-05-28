/**
 * Turns an unknown thrown or parsed API error value into a single display string.
 *
 * Tries common shapes: plain strings; objects with `message`, `detail`, or `data`;
 * nested `message` / `error` on object `data`; arrays (joined with commas, non-strings
 * JSON-stringified); then `Error.prototype.message`. Otherwise returns `fallback`.
 *
 * @param error - Value from a catch block, response body, or client error wrapper
 * @param fallback - String to use when nothing readable can be extracted
 * @returns A non-empty user-facing error message, or `fallback`
 */
export function extractApiErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again.",
): string {
  // 1. Handle primitives immediately
  if (typeof error === "string" && error.trim()) return error;

  // 2. Narrow to object and ensure it's not null
  if (typeof error !== "object" || error === null) return fallback;

  // 3. Use unknown for the record values to satisfy the linter
  const e = error as Record<string, unknown>;

  // 4. Extract potential message sources
  const candidate = e.message ?? e.detail ?? e.data;

  // 5. Narrow 'candidate' safely
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate;
  }

  // 6.1 Handle case of nested objects
  if (typeof candidate === "object" && candidate !== null) {
    const nested = candidate as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
    if (typeof nested.error === "string") return nested.error;
  }

  // 6.2 Handle case of arrays
  if (Array.isArray(candidate)) {
    return candidate
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join(", ");
  }

  // 7. Final check for standard Error instances
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
