export function extractApiErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again.",
): string {
  // 1. Handle strings or non-objects immediately
  if (typeof error === "string" && error.trim()) return error;
  if (!error || typeof error !== "object") return fallback;

  const e = error as Record<string, any>;

  // 2. Prioritize common API fields: 'message' or 'detail'
  const candidate = e.message ?? e.detail;

  // 3. If it's a string, use it
  if (typeof candidate === "string" && candidate.trim()) return candidate;

  // 4. If it's an array (common in validation errors), join it
  if (Array.isArray(candidate)) {
    return candidate
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join(", ");
  }

  // 5. Fallback to standard Error object message
  if (error instanceof Error && error.message) return error.message;

  return fallback;
}
