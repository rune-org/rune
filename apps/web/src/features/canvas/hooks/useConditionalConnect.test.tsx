import { describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";
import type { Edge } from "@xyflow/react";
import { SWITCH_FALLBACK_HANDLE_ID } from "../utils/switchHandles";
import { useConditionalConnect } from "./useConditionalConnect";

vi.mock("../utils/id", () => ({
  createId: () => "edge-fixed-id",
}));

describe("useConditionalConnect", () => {
  it("creates labeled branch edges for conditional and switch connections", () => {
    const edges: Edge[] = [];
    const setEdges = vi.fn((updater: (edges: Edge[]) => Edge[] | Edge[]) => {
      const next = typeof updater === "function" ? updater(edges) : updater;
      edges.splice(0, edges.length, ...(next as Edge[]));
    });

    let onConnect: ReturnType<typeof useConditionalConnect> | null = null;
    function Harness() {
      onConnect = useConditionalConnect(setEdges);
      return null;
    }

    render(<Harness />);

    onConnect?.({ source: "if", target: "ok", sourceHandle: "true" });
    onConnect?.({ source: "switch", target: "fallback", sourceHandle: SWITCH_FALLBACK_HANDLE_ID });
    onConnect?.({ source: "switch", target: "case", sourceHandle: "switch-case-0" });

    expect(edges).toHaveLength(3);
    expect(edges[0]).toEqual(
      expect.objectContaining({
        id: "edge-fixed-id",
        source: "if",
        target: "ok",
        sourceHandle: "true",
        label: "true",
        type: "default",
        labelShowBg: true,
      }),
    );
    expect(edges[1]).toEqual(
      expect.objectContaining({
        sourceHandle: SWITCH_FALLBACK_HANDLE_ID,
        label: "fallback",
        labelShowBg: true,
      }),
    );
    expect(edges[2]).toEqual(
      expect.objectContaining({
        sourceHandle: "switch-case-0",
        label: "case 1",
        labelShowBg: true,
      }),
    );
  });

  it("creates unlabeled default edges for regular node connections", () => {
    const edges: Edge[] = [];
    const setEdges = vi.fn((updater: (edges: Edge[]) => Edge[] | Edge[]) => {
      const next = typeof updater === "function" ? updater(edges) : updater;
      edges.splice(0, edges.length, ...(next as Edge[]));
    });

    let onConnect: ReturnType<typeof useConditionalConnect> | null = null;
    function Harness() {
      onConnect = useConditionalConnect(setEdges);
      return null;
    }

    render(<Harness />);
    onConnect?.({ source: "trigger", target: "log" });

    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual(
      expect.objectContaining({
        source: "trigger",
        target: "log",
        label: undefined,
        labelShowBg: false,
        labelBgStyle: undefined,
      }),
    );
  });
});
