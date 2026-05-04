import { describe, it, expect } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("test_returns_default_initial_for_empty_or_whitespace_name", () => {
    expect(getInitials("")).toBe("U");
    expect(getInitials("   ")).toBe("U");
    expect(getInitials("\n\t  ")).toBe("U");
  });

  it("test_single_token_name_uses_uppercase_first_letter", () => {
    expect(getInitials("John")).toBe("J");
    expect(getInitials("alice")).toBe("A");
  });

  it("test_multi_part_name_uses_first_and_last_tokens", () => {
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("John Q Public")).toBe("JP");
    expect(getInitials("  Alice   Bob  ")).toBe("AB");
    expect(getInitials("John\tDoe")).toBe("JD");
  });

  it("test_single_character_tokens_are_kept", () => {
    expect(getInitials("A")).toBe("A");
    expect(getInitials("A B")).toBe("AB");
  });

  it("test_non_latin_names_use_first_and_last_characters", () => {
    expect(getInitials("أحمد محمد")).toBe("أم");
  });

  it("test_punctuation_inside_tokens_does_not_split_name_parts", () => {
    expect(getInitials("John-Doe")).toBe("J");
    expect(getInitials("John O'Connor")).toBe("JO");
  });
});
