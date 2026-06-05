import { describe, expect, it } from "vitest";
import { searchLibrary } from "./librarySearch";

describe("searchLibrary", () => {
  it("returns nothing for empty or whitespace queries", () => {
    expect(searchLibrary("")).toEqual([]);
    expect(searchLibrary("   ")).toEqual([]);
  });

  it("surfaces the agent node for the alias 'ai'", () => {
    const results = searchLibrary("ai");
    expect(results[0]?.kind).toBe("agent");
  });

  it("surfaces the http node for the alias 'api'", () => {
    const results = searchLibrary("api");
    expect(results[0]?.kind).toBe("http");
  });

  it("finds both runic and integration nodes for 'email'", () => {
    const kinds = searchLibrary("email").map((r) => r.kind);
    expect(kinds).toContain("smtp");
    expect(kinds).toContain("integration.google.gmail.send_email");
    expect(kinds).toContain("integration.microsoft.outlook.send_email");
  });

  it("finds branching nodes for 'condition'", () => {
    const kinds = searchLibrary("condition").map((r) => r.kind);
    expect(kinds).toContain("if");
    expect(kinds).toContain("switch");
  });

  it("matches integration nodes by service name", () => {
    const kinds = searchLibrary("gmail").map((r) => r.kind);
    expect(kinds).toContain("integration.google.gmail.send_email");
  });

  it("tolerates typos via fuzzy subsequence matching", () => {
    const kinds = searchLibrary("agnt").map((r) => r.kind);
    expect(kinds).toContain("agent");
  });

  it("tolerates transposition and substitution typos", () => {
    expect(searchLibrary("agnet").map((r) => r.kind)).toContain("agent");
    expect(searchLibrary("swtich").map((r) => r.kind)).toContain("switch");
    expect(searchLibrary("emial").map((r) => r.kind)).toContain("smtp");
    expect(searchLibrary("shets").map((r) => r.kind)).toContain(
      "integration.google.sheets.read_range",
    );
  });

  it("never returns the sticky note node", () => {
    const kinds = searchLibrary("note").map((r) => r.kind);
    expect(kinds).not.toContain("stickyNote");
  });

  it("requires every token of a multi-word query to match", () => {
    const kinds = searchLibrary("send email").map((r) => r.kind);
    expect(kinds).toContain("integration.google.gmail.send_email");
    expect(searchLibrary("send zzzzqqq")).toEqual([]);
  });
});
