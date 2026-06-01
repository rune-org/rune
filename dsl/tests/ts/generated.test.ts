import { describe, it, expect } from "vitest";
import {
  type Workflow,
  type Edge,
  type HttpNode,
  type WebhookNode,
  type HttpParameters,
  type Note,
  sanitizeWorkflow,
  sanitizeEdge,
  sanitizeHttpParameters,
  sanitizeNote,
} from "../../generated/types";

describe("generated DSL types", () => {
  it("sanitizeWorkflow accepts valid workflow with mock data", () => {
    const mockHttpParams: HttpParameters = {
      method: "GET",
      url: "https://api.example.com",
      body: undefined,
      query: undefined,
      headers: undefined,
      retry: undefined,
      retry_delay: undefined,
      timeout: undefined,
      raise_on_status: undefined,
      ignore_ssl: undefined,
    };
    const mockNode: HttpNode = {
      id: "node_1",
      name: "Fetch API",
      trigger: false,
      webhook_guid: undefined,
      output: {},
      error: undefined,
      credentials: undefined,
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
      notes: undefined,
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
      body: undefined,
      query: undefined,
      headers: undefined,
      retry: undefined,
      retry_delay: undefined,
      timeout: undefined,
      raise_on_status: undefined,
      ignore_ssl: undefined,
    };
    const result = sanitizeHttpParameters(mockParams);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("sanitizeWorkflow accepts a webhook trigger node with webhook_guid", () => {
    const mockNode: WebhookNode = {
      id: "webhook_1",
      name: "Webhook",
      trigger: true,
      webhook_guid: "123e4567-e89b-12d3-a456-426614174000",
      output: {},
      error: undefined,
      credentials: undefined,
      type: "webhook",
      parameters: {},
      credential_type: undefined,
    };
    const mockWorkflow: Workflow = {
      workflow_id: "wf_1",
      execution_id: "exec_1",
      nodes: [mockNode],
      edges: [],
      notes: undefined,
    };

    const result = sanitizeWorkflow(mockWorkflow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("sanitizeNote accepts a valid decorative note", () => {
    const mockNote: Note = {
      id: "note_1",
      content: "# Title\n\nbody",
      x: 10,
      y: 20,
      width: 240,
      height: 180,
      color: "yellow",
      font_size: "md",
    };
    const result = sanitizeNote(mockNote);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("sanitizeWorkflow rejects workflow with missing workflow_id", () => {
    const mockWorkflow = {
      workflow_id: undefined as unknown as string,
      execution_id: "exec_1",
      nodes: [] as Workflow["nodes"],
      edges: [] as Workflow["edges"],
      notes: undefined,
    };
    const result = sanitizeWorkflow(mockWorkflow);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("workflow_id"))).toBe(true);
  });
});
