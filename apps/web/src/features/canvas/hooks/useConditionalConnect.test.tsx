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

    const onConnect = { current: null as ReturnType<typeof useConditionalConnect> | null };
    function Harness() {
      onConnect.current = useConditionalConnect(setEdges);
      return null;
    }

    render(<Harness />);

    const connect = onConnect.current;
    if (!connect) throw new Error("useConditionalConnect did not return a callback");
    connect({ source: "if", target: "ok", sourceHandle: "true", targetHandle: null });
    connect({
      source: "switch",
      target: "fallback",
      sourceHandle: SWITCH_FALLBACK_HANDLE_ID,
      targetHandle: null,
    });
    connect({
      source: "switch",
      target: "case",
      sourceHandle: "switch-case-0",
      targetHandle: null,
    });

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

    const onConnect = { current: null as ReturnType<typeof useConditionalConnect> | null };
    function Harness() {
      onConnect.current = useConditionalConnect(setEdges);
      return null;
    }

    render(<Harness />);
    const connect = onConnect.current;
    if (!connect) throw new Error("useConditionalConnect did not return a callback");
    connect({ source: "trigger", target: "log", sourceHandle: null, targetHandle: null });

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
