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
  const candidate = e.message ?? e.detail;

  // 5. Narrow 'candidate' safely
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate;
  }

  if (Array.isArray(candidate)) {
    return candidate
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join(", ");
  }

  // 6. Final check for standard Error instances
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
