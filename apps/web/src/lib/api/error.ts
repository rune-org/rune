export function extractApiErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again.",
): string {
  if (typeof error !== "object" || error === null) return fallback;
  const e = error as Record<string, unknown>;
  if (typeof e.message === "string") {
    if (Array.isArray(e.data) && e.data.length > 0 && e.data.every((v) => typeof v === "string")) {
      return (e.data as string[]).join(", ");
    }
    return e.message;
  }
  return fallback;
}
