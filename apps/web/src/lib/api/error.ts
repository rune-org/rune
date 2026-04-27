/**
 * Extracts a human-readable message from an API error value.
 *
 * All API errors in this codebase go through the global `http_exception_handler`
 * which normalises every HTTPException into:
 *   { success: false, message: "...", data: null }
 *
 * So we only need to read `message` — there is no `detail` field on any
 * error response this backend sends to the frontend.
 */
export function extractApiErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred. Please try again.",
): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const rec = error as Record<string, unknown>;

  if ("message" in rec) {
    const m = rec.message;
    if (typeof m === "string" && m.trim()) {
      return m;
    }
    if (m != null && typeof m !== "object") {
      return String(m);
    }
  }

  if ("detail" in rec) {
    const d = rec.detail;
    if (typeof d === "string" && d.trim()) {
      return d;
    }
    if (Array.isArray(d)) {
      return d.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("; ");
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
