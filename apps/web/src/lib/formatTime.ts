const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always", style: "narrow" });

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Format a date string as a relative time (e.g. "5 min. ago", "3 hr. ago").
 * Returns "N/A" for null/undefined values.
 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  const diffMs = Date.now() - new Date(iso).getTime();

  if (diffMs < MINUTE) return "Just now";
  if (diffMs < HOUR) return rtf.format(-Math.floor(diffMs / MINUTE), "minute");
  if (diffMs < DAY) return rtf.format(-Math.floor(diffMs / HOUR), "hour");
  if (diffMs < 7 * DAY) return rtf.format(-Math.floor(diffMs / DAY), "day");
  return new Date(iso).toLocaleDateString();
}

/**
 * Format a date string as an absolute locale timestamp (e.g. "3/15/2026, 2:34:12 PM").
 * Intended for tooltip content alongside relative times.
 */
export function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
