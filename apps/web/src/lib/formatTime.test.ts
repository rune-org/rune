import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatAbsoluteTime, formatRelativeTime } from "./formatTime";

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always", style: "narrow" });

describe("formatTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns N/A for empty values", () => {
    expect(formatRelativeTime(null)).toBe("N/A");
    expect(formatRelativeTime(undefined)).toBe("N/A");
  });

  it("formats recent values as relative time", () => {
    expect(formatRelativeTime("2026-03-29T11:59:30Z")).toBe("Just now");
    expect(formatRelativeTime("2026-03-29T11:55:00Z")).toBe(rtf.format(-5, "minute"));
    expect(formatRelativeTime("2026-03-29T09:00:00Z")).toBe(rtf.format(-3, "hour"));
    expect(formatRelativeTime("2026-03-27T12:00:00Z")).toBe(rtf.format(-2, "day"));
  });

  it("falls back to locale dates for older values", () => {
    const iso = "2026-03-20T12:00:00Z";

    expect(formatRelativeTime(iso)).toBe(new Date(iso).toLocaleDateString());
    expect(formatAbsoluteTime(iso)).toBe(new Date(iso).toLocaleString());
  });
});
