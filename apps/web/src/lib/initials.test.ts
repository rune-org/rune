import { describe, it, expect } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("returns default initial for empty or whitespace name", () => {
    expect(getInitials("")).toBe("U");
    expect(getInitials("   ")).toBe("U");
    expect(getInitials("\n\t  ")).toBe("U");
  });

  it("uses uppercase first letter for single token names", () => {
    expect(getInitials("John")).toBe("J");
    expect(getInitials("alice")).toBe("A");
  });

  it("uses first and last tokens for multi-part names", () => {
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("John Q Public")).toBe("JP");
    expect(getInitials("  Alice   Bob  ")).toBe("AB");
    expect(getInitials("John\tDoe")).toBe("JD");
  });

  it("keeps single character tokens", () => {
    expect(getInitials("A")).toBe("A");
    expect(getInitials("A B")).toBe("AB");
  });

  it("uses first and last characters for non-latin names", () => {
    expect(getInitials("أحمد محمد")).toBe("أم");
  });

  it("does not split name parts on punctuation inside tokens", () => {
    expect(getInitials("John-Doe")).toBe("J");
    expect(getInitials("John O'Connor")).toBe("JO");
  });
});
