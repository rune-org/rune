import { describe, expect, it } from "vitest";

import { extractGraphSnapshot, rtesDocToExecutionState } from "./executionConversion";
import { nodeExecutionInstanceKey } from "../types/execution";

describe("executionConversion", () => {
  it("extractGraphSnapshot returns undefined when execution has no nodes", () => {
    expect(
      extractGraphSnapshot({
        execution_id: "exec-1",
        workflow_id: "7",
        nodes: {},
      }),
    ).toBeUndefined();
  });

  it("extractGraphSnapshot preserves valid graph branches and removes invalid nodes/edges", () => {
    const snapshot = extractGraphSnapshot({
      execution_id: "exec-graph",
      workflow_id: "99",
      nodes: {
        trigger: {
          name: "Manual Trigger",
          type: "ManualTrigger",
          position: [0, 0],
          latest: { status: "success" },
        },
        ifNode: {
          name: "Branch",
          type: "conditional",
          position: [200, 0],
          latest: { status: "success" },
        },
        successNode: {
          name: "Success path",
          type: "log",
          position: [400, -120],
          latest: { status: "success" },
        },
        failedNode: {
          name: "Failure path",
          type: "log",
          position: [400, 120],
          latest: { status: "error" },
        },
        unsafeNode: {
          name: "Unsafe",
          type: "non-existent-type",
          position: [600, 0],
          latest: { status: "running" },
        },
      },
      edges: [
        { id: "edge-1", src: "trigger", dst: "ifNode" },
        { id: "edge-2", src: "ifNode", dst: "successNode", label: "true" },
        { id: "edge-3", src: "ifNode", dst: "failedNode", label: "false" },
        { id: "edge-4", src: "ifNode", dst: "unsafeNode", label: "true" },
      ],
    });

    expect(snapshot).toBeDefined();
    expect(snapshot?.nodes.map((node) => node.id)).toEqual([
      "trigger",
      "ifNode",
      "successNode",
      "failedNode",
    ]);
    expect(snapshot?.edges.map((edge) => edge.id)).toEqual(["edge-1", "edge-2", "edge-3"]);
    expect(snapshot?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "edge-2", sourceHandle: "true", label: "true" }),
        expect.objectContaining({ id: "edge-3", sourceHandle: "false", label: "false" }),
      ]),
    );
  });

  it("extractGraphSnapshot preserves webhook GUIDs in historical graph snapshots", () => {
    const snapshot = extractGraphSnapshot({
      execution_id: "exec-webhook",
      workflow_id: "7",
      nodes: {
        "webhook-1": {
          position: [10, 20],
          name: "Webhook",
          type: "webhook",
          trigger: true,
          webhook_guid: "hook-guid",
          latest: { status: "success" },
        },
      },
      edges: [],
    });

    expect(snapshot?.nodes).toEqual([
      expect.objectContaining({
        id: "webhook-1",
        type: "webhookTrigger",
        position: { x: 10, y: 20 },
        data: expect.objectContaining({ webhookGuid: "hook-guid" }),
      }),
    ]);
  });

  it("extractGraphSnapshot applies auto-layout when stored node positions are missing", () => {
    const snapshot = extractGraphSnapshot({
      execution_id: "exec-no-positions",
      workflow_id: "13",
      nodes: {
        trigger: {
          name: "Manual Trigger",
          type: "ManualTrigger",
          latest: { status: "success" },
        },
        http: {
          name: "Call API",
          type: "http",
          latest: { status: "success" },
        },
        log: {
          name: "Log output",
          type: "log",
          latest: { status: "success" },
        },
      },
      edges: [
        { id: "edge-1", src: "trigger", dst: "http" },
        { id: "edge-2", src: "http", dst: "log" },
      ],
    });

    expect(snapshot).toBeDefined();
    expect(snapshot?.nodes.map((node) => node.id)).toEqual(["trigger", "http", "log"]);
    expect(snapshot?.nodes.every((node) => Number.isFinite(node.position.x))).toBe(true);
    expect(snapshot?.nodes.every((node) => Number.isFinite(node.position.y))).toBe(true);
    expect(snapshot?.nodes.some((node) => node.position.x !== 100 || node.position.y !== 100)).toBe(
      true,
    );
  });

  it("maps realistic mixed execution outcomes to frontend state", () => {
    const state = rtesDocToExecutionState({
      execution_id: "exec-42",
      workflow_id: "12",
      status: "running",
      created_at: "2026-03-29T12:00:00Z",
      nodes: {
        trigger: {
          name: "Manual Trigger",
          type: "ManualTrigger",
          position: [0, 0],
          latest: {
            status: "completed",
            output: { ok: true },
            duration_ms: 20,
            executed_at: "2026-03-29T12:00:01Z",
          },
        },
        http: {
          name: "Call API",
          type: "http",
          position: [260, 0],
          latest: {
            status: "error",
            output: { statusCode: 500 },
            duration_ms: 153,
            executed_at: "2026-03-29T12:00:02Z",
            error: { message: "Upstream timeout", code: "HTTP_TIMEOUT" },
          },
        },
        transform: {
          name: "Transform payload",
          type: "edit",
          position: [520, 0],
          latest: {
            status: "pending",
          },
        },
        staleNode: {
          name: "Old node with no run",
          type: "log",
          position: [780, 0],
        },
      },
      edges: [
        { id: "a", src: "trigger", dst: "http" },
        { id: "b", src: "http", dst: "transform" },
      ],
    });

    expect(state.executionId).toBe("exec-42");
    expect(state.workflowId).toBe(12);
    expect(state.status).toBe("running");
    expect(state.startedAt).toBe("2026-03-29T12:00:00Z");
    expect(state.graphSnapshot?.nodes.map((node) => node.id)).toEqual([
      "trigger",
      "http",
      "transform",
      "staleNode",
    ]);
    expect(state.graphSnapshot?.edges.map((edge) => edge.id)).toEqual(["a", "b"]);

    expect(state.nodes.get("trigger")).toEqual({
      nodeId: "trigger",
      status: "success",
      output: { ok: true },
      error: undefined,
      executedAt: "2026-03-29T12:00:01Z",
      durationMs: 20,
    });
    expect(state.nodeExecutions.get("trigger")).toEqual([
      expect.objectContaining({
        nodeId: "trigger",
        status: "success",
        output: { ok: true },
        error: undefined,
        executedAt: "2026-03-29T12:00:01Z",
        durationMs: 20,
        lineageHash: undefined,
        branchId: undefined,
        itemIndex: undefined,
        totalItems: undefined,
      }),
    ]);
    expect(state.nodes.get("http")).toEqual({
      nodeId: "http",
      status: "failed",
      output: { statusCode: 500 },
      error: { message: "Upstream timeout", code: "HTTP_TIMEOUT", details: undefined },
      executedAt: "2026-03-29T12:00:02Z",
      durationMs: 153,
    });
    expect(state.nodes.get("transform")).toEqual({
      nodeId: "transform",
      status: "waiting",
      output: undefined,
      error: undefined,
      executedAt: undefined,
      durationMs: undefined,
    });
    expect(state.nodes.has("staleNode")).toBe(false);
  });

  it("maps halted executions with partial node progress into stable frontend statuses", () => {
    const state = rtesDocToExecutionState({
      execution_id: "exec-43",
      workflow_id: "12",
      status: "halted",
      created_at: "2026-03-29T12:00:00Z",
      nodes: {
        done: {
          name: "Done step",
          type: "log",
          position: [0, 0],
          latest: { status: "success", executed_at: "2026-03-29T12:00:01Z" },
        },
        waiting: {
          name: "Waiting step",
          type: "http",
          position: [200, 0],
          latest: { status: "pending" },
        },
        unknown: {
          name: "Unknown status step",
          type: "edit",
          position: [400, 0],
          latest: { status: "not-a-real-status" },
        },
      },
      edges: [
        { id: "a", src: "done", dst: "waiting" },
        { id: "b", src: "waiting", dst: "unknown" },
      ],
    });

    expect(state.status).toBe("halted");
    expect(state.nodes.get("done")?.status).toBe("success");
    expect(state.nodes.get("waiting")?.status).toBe("waiting");
    expect(state.nodes.get("unknown")?.status).toBe("idle");
    expect(state.graphSnapshot?.nodes.map((node) => node.id)).toEqual([
      "done",
      "waiting",
      "unknown",
    ]);
  });

  it("preserves split lineage executions for per-item runtime data", () => {
    const state = rtesDocToExecutionState({
      execution_id: "exec-44",
      workflow_id: "12",
      status: "completed",
      nodes: {
        "log-1": {
          position: [0, 0],
          type: "log",
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

  it("produces the same instance key for historical and live split executions", () => {
    const state = rtesDocToExecutionState({
      execution_id: "exec-45",
      workflow_id: "12",
      status: "completed",
      nodes: {
        "log-1": {
          position: [0, 0],
          type: "log",
          latest: { status: "completed", output: { item: 2 } },
          lineages: {
            branch2: {
              status: "completed",
              output: { item: 2 },
              split_node_id: "split-1",
              branch_id: "exec_split_2",
              item_index: 2,
              total_items: 3,
            },
          },
        },
      },
      edges: [],
    });

    const historicalExecution = state.nodeExecutions.get("log-1")?.[0];
    expect(historicalExecution).toBeDefined();
    expect(nodeExecutionInstanceKey(historicalExecution!)).toBe("stack:split-1:2");
  });
});
