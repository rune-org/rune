import { beforeEach, describe, expect, it, vi } from "vitest";

const workflowDataToCanvasMock = vi.hoisted(() => vi.fn());
const sanitizeGraphMock = vi.hoisted(() => vi.fn());
const applyAutoLayoutMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/workflow-dsl", () => ({
  workflowDataToCanvas: workflowDataToCanvasMock,
}));

vi.mock("./graphIO", () => ({
  sanitizeGraph: sanitizeGraphMock,
}));

vi.mock("./autoLayout", () => ({
  applyAutoLayout: applyAutoLayoutMock,
}));

import { extractGraphSnapshot, rtesDocToExecutionState } from "./executionConversion";

describe("executionConversion", () => {
  beforeEach(() => {
    workflowDataToCanvasMock.mockReset();
    sanitizeGraphMock.mockReset();
    applyAutoLayoutMock.mockReset();
  });

  it("returns undefined when no graph nodes exist", () => {
    expect(
      extractGraphSnapshot({
        execution_id: "exec-1",
        workflow_id: "7",
        nodes: {},
      }),
    ).toBeUndefined();
  });

  it("returns sanitized graph snapshots without auto-layout when positions are stored", () => {
    const sanitized = {
      nodes: [{ id: "trigger-1", position: { x: 10, y: 20 }, type: "trigger", data: {} }],
      edges: [],
    };

    workflowDataToCanvasMock.mockReturnValue(sanitized);
    sanitizeGraphMock.mockReturnValue(sanitized);

    const result = extractGraphSnapshot({
      execution_id: "exec-1",
      workflow_id: "7",
      nodes: {
        "trigger-1": {
          position: [10, 20],
          name: "Trigger",
          type: "ManualTrigger",
          latest: { status: "success" },
        },
      },
      edges: [],
    });

    expect(result).toEqual(sanitized);
    expect(applyAutoLayoutMock).not.toHaveBeenCalled();
  });

  it("auto-layouts snapshots when execution nodes have no stored positions", () => {
    const sanitized = {
      nodes: [
        { id: "a", position: { x: 0, y: 0 }, type: "trigger", data: {} },
        { id: "b", position: { x: 0, y: 0 }, type: "log", data: {} },
      ],
      edges: [{ id: "edge-1", source: "a", target: "b" }],
    };
    const layouted = {
      nodes: [
        { id: "a", position: { x: 0, y: 0 }, type: "trigger", data: {} },
        { id: "b", position: { x: 300, y: 0 }, type: "log", data: {} },
      ],
      edges: sanitized.edges,
    };

    workflowDataToCanvasMock.mockReturnValue(sanitized);
    sanitizeGraphMock.mockReturnValue(sanitized);
    applyAutoLayoutMock.mockReturnValue(layouted);

    const result = extractGraphSnapshot({
      execution_id: "exec-1",
      workflow_id: "7",
      nodes: {
        a: { latest: { name: "A", node_type: "ManualTrigger" } },
        b: { latest: { name: "B", node_type: "log" } },
      },
      edges: [{ id: "edge-1", src: "a", dst: "b" }],
    });

    expect(applyAutoLayoutMock).toHaveBeenCalledWith({
      nodes: sanitized.nodes,
      edges: sanitized.edges,
      respectPinned: false,
    });
    expect(result).toEqual(layouted);
  });

  it("maps RTES execution documents into frontend execution state", () => {
    const sanitized = {
      nodes: [{ id: "a", position: { x: 0, y: 0 }, type: "trigger", data: {} }],
      edges: [],
    };

    workflowDataToCanvasMock.mockReturnValue(sanitized);
    sanitizeGraphMock.mockReturnValue(sanitized);

    const state = rtesDocToExecutionState({
      execution_id: "exec-42",
      workflow_id: "12",
      status: "completed",
      created_at: "2026-03-29T12:00:00Z",
      nodes: {
        a: {
          position: [0, 0],
          latest: {
            status: "completed",
            output: { ok: true },
            duration_ms: 150,
            executed_at: "2026-03-29T12:00:01Z",
            error: { message: "boom", code: "ERR" },
          },
        },
      },
      edges: [],
    });

    expect(state.executionId).toBe("exec-42");
    expect(state.workflowId).toBe(12);
    expect(state.status).toBe("completed");
    expect(state.graphSnapshot).toEqual(sanitized);
    expect(state.nodes.get("a")).toEqual({
      nodeId: "a",
      status: "success",
      output: { ok: true },
      error: { message: "boom", code: "ERR", details: undefined },
      executedAt: "2026-03-29T12:00:01Z",
      durationMs: 150,
    });
    expect(state.nodeExecutions.get("a")).toEqual([
      {
        nodeId: "a",
        status: "success",
        output: { ok: true },
        error: { message: "boom", code: "ERR", details: undefined },
        executedAt: "2026-03-29T12:00:01Z",
        durationMs: 150,
        lineageHash: undefined,
        branchId: undefined,
        itemIndex: undefined,
        totalItems: undefined,
      },
    ]);
  });

  it("preserves split lineage executions for per-item runtime data", () => {
    const sanitized = {
      nodes: [{ id: "log-1", position: { x: 0, y: 0 }, type: "log", data: {} }],
      edges: [],
    };

    workflowDataToCanvasMock.mockReturnValue(sanitized);
    sanitizeGraphMock.mockReturnValue(sanitized);

    const state = rtesDocToExecutionState({
      execution_id: "exec-42",
      workflow_id: "12",
      status: "completed",
      nodes: {
        "log-1": {
          position: [0, 0],
          latest: {
            status: "completed",
            output: { item: 1 },
            item_index: 1,
            total_items: 2,
          },
          lineages: {
            branch0: {
              status: "completed",
              input: { id: 0 },
              output: { item: 0 },
              lineage_hash: "branch0",
              branch_id: "exec_split_0",
              item_index: 0,
              total_items: 2,
            },
            branch1: {
              status: "completed",
              input: { id: 1 },
              output: { item: 1 },
              lineage_hash: "branch1",
              branch_id: "exec_split_1",
              item_index: 1,
              total_items: 2,
            },
          },
        },
      },
      edges: [],
    });

    expect(state.nodes.get("log-1")?.output).toEqual({ item: 1 });
    expect(state.nodeExecutions.get("log-1")?.map((execution) => execution.output)).toEqual([
      { item: 0 },
      { item: 1 },
    ]);
  });
});
