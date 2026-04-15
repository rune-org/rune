import { describe, it, expect } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("returns 'U' for empty string", () => {
    expect(getInitials("")).toBe("U");
  });

  it("returns 'U' for whitespace only", () => {
    expect(getInitials("   ")).toBe("U");
  });

  it("returns 'U' for null-like values", () => {
    expect(getInitials("")).toBe("U");
  });

  it("returns first letter uppercase for single name", () => {
    expect(getInitials("John")).toBe("J");
  });

  it("returns first letters of first and last name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("returns first letters with multiple spaces", () => {
    expect(getInitials("John   Doe")).toBe("JD");
  });

  it("handles leading and trailing whitespace", () => {
    expect(getInitials("  John Doe  ")).toBe("JD");
  });

  it("handles names with leading/trailing/multiple spaces", () => {
    expect(getInitials("  Alice   Bob  ")).toBe("AB");
  });

  it("handles multiple spaces inside names", () => {
    expect(getInitials("John      Doe")).toBe("JD");
  });

  it("handles tabs and mixed whitespace", () => {
    expect(getInitials("John\tDoe")).toBe("JD");
    expect(getInitials("John \t Doe")).toBe("JD");
  });

  it("returns first and last for names with multiple parts", () => {
    expect(getInitials("John Q Public")).toBe("JP");
  });

  it("handles single letter names", () => {
    expect(getInitials("A")).toBe("A");
  });

  it("handles names with single letters", () => {
    expect(getInitials("A B")).toBe("AB");
  });

  it("returns uppercase initials", () => {
    expect(getInitials("alice bob")).toBe("AB");
  });

  it("handles arabic characters", () => {
    expect(getInitials("أحمد محمد")).toBe("أم");
  });

  it("handles names with non-alphabetic characters", () => {
    expect(getInitials("John-Doe")).toBe("J");
    expect(getInitials("John O'Connor")).toBe("JO");
  });
});
