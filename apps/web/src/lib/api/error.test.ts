import { describe, expect, it } from "vitest";

import { extractApiErrorMessage } from "./error";

describe("extractApiErrorMessage", () => {
  it("returns the backend message when present", () => {
    expect(extractApiErrorMessage({ message: "Nope" })).toBe("Nope");
  });

  it("returns non-empty string errors as-is", () => {
    expect(extractApiErrorMessage("bad")).toBe("bad");
    expect(extractApiErrorMessage(null, "Custom fallback")).toBe("Custom fallback");
  });

  it("returns detail when message is absent (e.g. raw FastAPI shape)", () => {
    expect(extractApiErrorMessage({ detail: "Not found" })).toBe("Not found");
  });
});
