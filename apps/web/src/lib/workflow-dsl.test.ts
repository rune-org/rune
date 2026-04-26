import { describe, expect, it } from "vitest";

import type { CanvasEdge, CanvasNode, NodeDataMap, NodeKind } from "@/features/canvas/types";
import { switchFallbackHandleId, switchRuleHandleId } from "@/features/canvas/utils/switchHandles";
import {
  canvasToWorkflowData,
  MissingNodeCredentialsError,
  stripCredentialsFromWorkflowData,
  workflowDataToCanvas,
  WorkflowEdge,
  WorkflowNode,
} from "./workflow-dsl";

function createNode<T extends NodeKind>(
  id: string,
  type: T,
  data: NodeDataMap[T],
  position: { x: number; y: number } = { x: 0, y: 0 },
): Extract<CanvasNode, { type: T }> {
  return { id, type, data, position } as Extract<CanvasNode, { type: T }>;
}

function createEdge(
  edge: Partial<CanvasEdge> & Pick<CanvasEdge, "id" | "source" | "target">,
): CanvasEdge {
  return { type: "default", ...edge } as CanvasEdge;
}

describe("workflow DSL helpers", () => {
  it("throws when a credentialed node is missing credentials", () => {
    const smtpNode = createNode("smtp-1", "smtp", {
      label: "Send Email",
      from: "noreply@example.com",
      to: "team@example.com",
    });

    expect(() => canvasToWorkflowData([smtpNode], [])).toThrow(MissingNodeCredentialsError);
  });

  it("converts switch routes and sanitizes node names", () => {
    const switchNode = createNode("switch-1", "switch", {
      label: "123 Bad Label",
      rules: [{ value: "foo", operator: "contains", compare: "name" }, { value: "bar" }],
    });
    const caseNode = createNode("log-1", "log", { label: "Case 1" });
    const fallbackNode = createNode("log-2", "log", { label: "Fallback" });
    const edges = [
      createEdge({
        id: "edge-case-1",
        source: switchNode.id,
        target: caseNode.id,
        sourceHandle: switchRuleHandleId(0),
      }),
      createEdge({
        id: "edge-fallback",
        source: switchNode.id,
        target: fallbackNode.id,
        sourceHandle: switchFallbackHandleId(),
      }),
    ];

    const workflowData = canvasToWorkflowData([switchNode, caseNode, fallbackNode], edges);
    const switchDefinition = workflowData.nodes.find((node) => node.id === switchNode.id);

    expect(switchDefinition?.name).toBe("_Bad_Label");
    expect(switchDefinition?.parameters).toEqual({
      rules: [
        { value: "foo", operator: "contains", compare: "name" },
        { value: "bar", operator: "==", compare: undefined },
      ],
      routes: ["edge-case-1", null, "edge-fallback"],
    });
  });

  it("rehydrates canonical workflow data back into canvas nodes and edges", () => {
    const credential = { id: "cred-1", name: "SMTP", type: "smtp" };
    const restored = workflowDataToCanvas({
      nodes: [
        {
          id: "scheduled-1",
          name: "My Trigger",
          trigger: true,
          type: "ScheduledTrigger",
          parameters: { amount: 10, unit: "minutes" },
          output: {},
          error: undefined,
          credential_type: undefined,
          position: [120, 240],
        },
        {
          id: "smtp-1",
          name: "Send Email",
          trigger: false,
          type: "smtp",
          parameters: { to: ["a@example.com", "b@example.com"] },
          credentials: credential,
          output: {},
          error: undefined,
          credential_type: undefined,
          position: [300, 240],
        },
      ],
      edges: [
        { id: "true-edge", src: "scheduled-1", dst: "smtp-1", label: "true" },
        { id: "case-edge", src: "smtp-1", dst: "scheduled-1", label: "case 1" },
      ],
    });

    expect(restored.nodes[0]).toMatchObject({
      type: "scheduledTrigger",
      position: { x: 120, y: 240 },
      data: { label: "My_Trigger", amount: 10, unit: "minutes" },
    });
    expect(restored.nodes[1]).toMatchObject({
      type: "smtp",
      data: { credential, to: "a@example.com, b@example.com" },
    });
    expect(restored.edges[0]).toMatchObject({
      id: "true-edge",
      sourceHandle: "true",
      label: "true",
    });
    expect(restored.edges[1]).toMatchObject({
      id: "case-edge",
      sourceHandle: switchRuleHandleId(0),
      label: "case 1",
    });
  });

  it("strips credential references from workflow data exports", () => {
    expect(
      stripCredentialsFromWorkflowData({
        nodes: [
          {
            id: "1",
            credentials: { id: "cred-1" },
            name: "Node 1",
            trigger: false,
            type: "log",
            parameters: {},
            output: {},
            error: undefined,
            credential_type: undefined,
          } as WorkflowNode,
        ],
        edges: [{ id: "edge-1", src: "1", dst: "2" } as WorkflowEdge],
      }),
    ).toEqual({
      nodes: [
        {
          id: "1",
          name: "Node 1",
          trigger: false,
          type: "log",
          parameters: {},
          output: {},
          error: undefined,
          credential_type: undefined,
        },
      ],
      edges: [{ id: "edge-1", src: "1", dst: "2" }],
    });
  });

  it("serializes http canvas fields to worker snake_case parameters", () => {
    const httpNode = createNode("http-1", "http", {
      label: "API",
      method: "PATCH",
      url: "https://example.com/orders",
      timeout: 45,
      retry: 2,
      retry_delay: 3,
      raise_on_status: "4xx,5xx",
      ignore_ssl: true,
    });
    const { nodes } = canvasToWorkflowData([httpNode], []);
    const def = nodes.find((n) => n.id === "http-1");
    expect(def?.type).toBe("http");
    expect(def?.parameters).toMatchObject({
      method: "PATCH",
      url: "https://example.com/orders",
      timeout: "45",
      retry: "2",
      retry_delay: "3",
      raise_on_status: "4xx,5xx",
      ignore_ssl: true,
    });
  });

  it("rehydrates http parameters from stored workflow_data", () => {
    const { nodes } = workflowDataToCanvas({
      nodes: [
        {
          id: "http-1",
          name: "API",
          trigger: false,
          type: "http",
          parameters: {
            method: "PATCH",
            url: "https://example.com",
            timeout: "45",
            retry: "2",
            retry_delay: "3",
            raise_on_status: "403,5xx",
            ignore_ssl: false,
          },
          output: {},
          position: [10, 20],
        },
      ],
      edges: [],
    });
    const http = nodes.find((n) => n.id === "http-1");
    expect(http?.type).toBe("http");
    expect(http?.data).toMatchObject({
      method: "PATCH",
      url: "https://example.com",
      timeout: 45,
      retry: 2,
      retry_delay: 3,
      raise_on_status: "403,5xx",
      ignore_ssl: false,
    });
  });

  it("treats blank raise_on_status as absent on the wire", () => {
    const httpNode = createNode("http-1", "http", {
      label: "API",
      method: "GET",
      url: "https://example.com",
      raise_on_status: "   ",
    });
    const { nodes } = canvasToWorkflowData([httpNode], []);
    expect(nodes[0].parameters.raise_on_status).toBeUndefined();
  });

  it("serializes legacy canvas retries field as retry", () => {
    const httpNode = createNode("http-1", "http", {
      label: "API",
      method: "GET",
      url: "https://example.com",
    });
    (httpNode.data as Record<string, unknown>)["retries"] = 4;
    const { nodes } = canvasToWorkflowData([httpNode], []);
    expect(nodes[0].parameters.retry).toBe("4");
  });

  it("prefers retry over legacy retries when both present", () => {
    const httpNode = createNode("http-1", "http", {
      label: "API",
      method: "GET",
      url: "https://example.com",
      retry: 1,
    });
    (httpNode.data as Record<string, unknown>)["retries"] = 9;
    const { nodes } = canvasToWorkflowData([httpNode], []);
    expect(nodes[0].parameters.retry).toBe("1");
  });
});
