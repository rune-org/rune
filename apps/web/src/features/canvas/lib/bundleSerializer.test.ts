import { describe, expect, it } from "vitest";
import { buildBundleEntry, serialiseBundleEntry, slugifyExternalId } from "./bundleSerializer";
import type { RFGraph } from "./graphIO";

const baseGraph: RFGraph = {
  nodes: [
    {
      id: "n1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { label: "Start" },
      // React Flow runtime noise that should be stripped
      selected: true,
      dragging: false,
      width: 200,
      height: 100,
      measured: { width: 200, height: 100 },
    } as unknown as RFGraph["nodes"][number],
  ],
  edges: [],
};

describe("slugifyExternalId", () => {
  it.each([
    ["Gmail → Slack daily digest", "gmail-slack-daily-digest"],
    ["Café résumé", "cafe-resume"],
    ["  trim and  collapse   spaces  ", "trim-and-collapse-spaces"],
    ["!@#$%^&*()", ""],
  ])("slugifies %s", (input, expected) => {
    expect(slugifyExternalId(input)).toBe(expected);
  });

  it("caps the slug at 80 chars", () => {
    expect(slugifyExternalId("a".repeat(120)).length).toBe(80);
  });
});

describe("buildBundleEntry", () => {
  it("strips React Flow runtime keys from nodes", () => {
    const entry = buildBundleEntry(baseGraph, {
      name: "Demo",
      description: "",
      category: "general",
      tags: [],
    });
    const node = entry.workflow_data.nodes[0];
    expect(node).not.toHaveProperty("selected");
    expect(node).not.toHaveProperty("dragging");
    expect(node).not.toHaveProperty("width");
    expect(node).not.toHaveProperty("height");
    expect(node).not.toHaveProperty("measured");
    // But preserves the real fields
    expect(node).toMatchObject({ id: "n1", type: "trigger", data: { label: "Start" } });
  });

  it("derives external_id from name when not overridden", () => {
    const entry = buildBundleEntry(baseGraph, {
      name: "Gmail → Slack",
      description: "",
      category: "email",
      tags: [],
    });
    expect(entry.external_id).toBe("gmail-slack");
  });

  it("respects externalIdOverride", () => {
    const entry = buildBundleEntry(baseGraph, {
      name: "Anything",
      description: "",
      category: "general",
      tags: [],
      externalIdOverride: "my-custom-slug",
    });
    expect(entry.external_id).toBe("my-custom-slug");
  });

  it("omits author when name is empty", () => {
    const entry = buildBundleEntry(baseGraph, {
      name: "X",
      description: "",
      category: "general",
      tags: [],
      author: { name: "  " },
    });
    expect(entry.author).toBeNull();
  });

  it("includes author with optional url when name is provided", () => {
    const entry = buildBundleEntry(baseGraph, {
      name: "X",
      description: "",
      category: "general",
      tags: [],
      author: { name: "Ada", url: "https://example.com" },
    });
    expect(entry.author).toEqual({ name: "Ada", url: "https://example.com" });
  });
});

describe("serialiseBundleEntry", () => {
  it("produces pretty JSON ending in a newline", () => {
    const entry = buildBundleEntry(baseGraph, {
      name: "Demo",
      description: "",
      category: "general",
      tags: [],
    });
    const out = serialiseBundleEntry(entry);
    expect(out.endsWith("\n")).toBe(true);
    expect(out).toContain('  "external_id": "demo"');
  });
});
