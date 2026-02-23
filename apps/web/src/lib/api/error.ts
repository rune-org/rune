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
    fallback = "An unexpected error occurred. Please try again."
): string {
    if (typeof error !== "object" || error === null) return fallback;

    if ("message" in error && typeof (error as Record<string, unknown>).message === "string") {
        return (error as { message: string }).message;
    }

    return fallback;
}
