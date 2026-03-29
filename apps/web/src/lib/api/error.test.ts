import { describe, expect, it } from "vitest";

import { extractApiErrorMessage } from "./error";

describe("extractApiErrorMessage", () => {
  it("returns the backend message when present", () => {
    expect(extractApiErrorMessage({ message: "Nope" })).toBe("Nope");
  });

  it("falls back for non-object values", () => {
    expect(extractApiErrorMessage("bad")).toBe("An unexpected error occurred. Please try again.");
    expect(extractApiErrorMessage(null, "Custom fallback")).toBe("Custom fallback");
  });

  it("falls back when the object has no message field", () => {
    expect(extractApiErrorMessage({ detail: "Ignored" })).toBe(
      "An unexpected error occurred. Please try again.",
    );
  });
});
