import { describe, it, expect } from "vitest";
import {
  type Workflow,
  type Edge,
  type HttpNode,
  type HttpParameters,
  sanitizeWorkflow,
  sanitizeEdge,
  sanitizeHttpParameters,
} from "../../generated/types";

describe("generated DSL types", () => {
  it("sanitizeWorkflow accepts valid workflow with mock data", () => {
    const mockHttpParams: HttpParameters = {
      method: "GET",
      url: "https://api.example.com",
    };
    const mockNode: HttpNode = {
      id: "node_1",
      name: "Fetch API",
      trigger: false,
      output: {},
      type: "http",
      parameters: mockHttpParams,
      credential_type: ["api_key", "oauth2", "basic_auth", "header", "token"],
    };
    const mockEdge: Edge = {
      id: "edge_1",
      src: "node_1",
      dst: "node_2",
    };
    const mockWorkflow: Workflow = {
      workflow_id: "wf_1",
      execution_id: "exec_1",
      nodes: [mockNode],
      edges: [mockEdge],
    };

    const result = sanitizeWorkflow(mockWorkflow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("sanitizeEdge accepts valid edge", () => {
    const mockEdge: Edge = {
      id: "e1",
      src: "n1",
      dst: "n2",
    };
    const result = sanitizeEdge(mockEdge);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("sanitizeHttpParameters accepts valid params", () => {
    const mockParams: HttpParameters = {
      method: "POST",
      url: "https://example.com",
    };
    const result = sanitizeHttpParameters(mockParams);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("sanitizeWorkflow rejects workflow with missing workflow_id", () => {
    const mockWorkflow = {
      workflow_id: undefined as unknown as string,
      execution_id: "exec_1",
      nodes: [] as Workflow["nodes"],
      edges: [] as Workflow["edges"],
    };
    const result = sanitizeWorkflow(mockWorkflow);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("workflow_id"))).toBe(true);
  });
});
