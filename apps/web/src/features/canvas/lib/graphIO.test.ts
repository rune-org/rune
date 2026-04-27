
import { describe, expect, it } from "vitest";

import {
  sanitizeGraph,
  stringifyGraph,
  stripExecutionStyling,
  tryParseGraphFromText,
} from "./graphIO";

describe("graphIO", () => {
  it("test_sanitize_graph_drops_unknown_nodes_and_orphaned_branch_edges", () => {
    const result = sanitizeGraph({
      nodes: [
        { id: "if-1", type: "if", position: { x: 0, y: 0 }, data: {} },
        { id: "log-1", type: "log", position: { x: 0, y: 0 }, data: {} },
        { id: "bad-1", type: "mystery", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: "if-true", source: "if-1", target: "log-1", sourceHandle: "true" },
        { id: "if-false", source: "if-1", target: "bad-1", sourceHandle: "false" },
      ],
    });

    expect(result.nodes.map((node) => node.id)).toEqual(["if-1", "log-1"]);
    expect(result.edges).toEqual([
      expect.objectContaining({ id: "if-true", source: "if-1", target: "log-1", label: "true" }),
    ]);
  });

  it("test_sanitize_graph_adds_default_labels_for_if_branch_edges", () => {
    const result = sanitizeGraph({
      nodes: [
        { id: "if-1", type: "if", position: { x: 0, y: 0 }, data: {} },
        { id: "log-1", type: "log", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: "true-edge", source: "if-1", target: "log-1", sourceHandle: "true" },
        { id: "false-edge", source: "if-1", target: "log-1", sourceHandle: "false" },
      ],
    });

    expect(result.edges).toEqual([
      expect.objectContaining({
        id: "true-edge",
        type: "default",
        label: "true",
        labelShowBg: true,
      }),
      expect.objectContaining({
        id: "false-edge",
        type: "default",
        label: "false",
        labelShowBg: true,
      }),
    ]);
  });

  it("test_sanitize_graph_normalizes_switch_edge_labels_and_handles", () => {
    const result = sanitizeGraph({
      nodes: [
        { id: "switch-1", type: "switch", position: { x: 0, y: 0 }, data: {} },
        { id: "log-1", type: "log", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: "true-edge", source: "switch-1", target: "log-1", sourceHandle: "true" },
        { id: "switch-edge", source: "switch-1", target: "log-1", label: "case 1" },
      ],
    });

    expect(result.edges).toEqual([
      expect.objectContaining({
        id: "true-edge",
        type: "default",
        label: "true",
        labelShowBg: true,
      }),
      expect.objectContaining({
        id: "switch-edge",
        type: "default",
        sourceHandle: "switch-case-0",
        label: "case 1",
        labelShowBg: true,
      }),
    ]);
  });

  it("test_stringify_graph_strips_sensitive_and_execution_only_fields_without_mutating_input", () => {
    const graph = {
      nodes: [
        {
          id: "smtp-1",
          type: "smtp",
          position: { x: 0, y: 0 },
          data: { credential: { id: "cred-1" }, label: "SMTP" },
        },
      ],
      edges: [
        {
          id: "edge-1",
          source: "smtp-1",
          target: "smtp-1",
          animated: true,
          style: { stroke: "red", strokeWidth: 2 },
        },
      ],
    };
    const json = stringifyGraph(graph);

    expect(JSON.parse(json)).toEqual({
      nodes: [
        {
          id: "smtp-1",
          type: "smtp",
          position: { x: 0, y: 0 },
          data: { label: "SMTP" },
        },
      ],
      edges: [
        {
          id: "edge-1",
          source: "smtp-1",
          target: "smtp-1",
          style: { strokeWidth: 2 },
        },
      ],
    });

    expect(graph).toEqual({
      nodes: [
        {
          id: "smtp-1",
          type: "smtp",
          position: { x: 0, y: 0 },
          data: { credential: { id: "cred-1" }, label: "SMTP" },
        },
      ],
      edges: [
        {
          id: "edge-1",
          source: "smtp-1",
          target: "smtp-1",
          animated: true,
          style: { stroke: "red", strokeWidth: 2 },
        },
      ],
    });
  });

  it("test_try_parse_graph_from_text_rejects_malformed_payloads", () => {
    expect(tryParseGraphFromText("not json")).toBeNull();
    expect(tryParseGraphFromText(JSON.stringify({ nope: true }))).toBeNull();
    expect(tryParseGraphFromText(JSON.stringify({ nodes: {}, edges: [] }))).toBeNull();
    expect(tryParseGraphFromText(JSON.stringify({ nodes: [], edges: {} }))).toBeNull();
  });

  it("test_try_parse_graph_from_text_sanitizes_valid_payload_and_strips_runtime_styling", () => {
    expect(
      tryParseGraphFromText(
        JSON.stringify({
          nodes: [{ id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        }),
      ),
    ).toEqual({
      nodes: [{ id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    });

    expect(
      stripExecutionStyling({
        nodes: [],
        edges: [{ id: "edge-1", source: "a", target: "b", animated: true }],
      }),
    ).toEqual({ nodes: [], edges: [{ id: "edge-1", source: "a", target: "b" }] });
  });
});
