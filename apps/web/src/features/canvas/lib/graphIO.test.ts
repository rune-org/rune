import { describe, expect, it } from "vitest";

import {
  sanitizeGraph,
  stringifyGraph,
  stripExecutionStyling,
  tryParseGraphFromText,
} from "./graphIO";

describe("graphIO", () => {
  it("drops unknown nodes and orphaned edges during sanitization", () => {
    const result = sanitizeGraph({
      nodes: [
        { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: {} },
        { id: "bad-1", type: "mystery", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: "edge-1", source: "trigger-1", target: "bad-1" },
        { id: "edge-2", source: "trigger-1", target: "trigger-1" },
      ],
    });

    expect(result.nodes.map((node) => node.id)).toEqual(["trigger-1"]);
    expect(result.edges).toEqual([
      expect.objectContaining({ id: "edge-2", source: "trigger-1", target: "trigger-1" }),
    ]);
  });

  it("normalizes branching edge metadata", () => {
    const result = sanitizeGraph({
      nodes: [
        { id: "if-1", type: "if", position: { x: 0, y: 0 }, data: {} },
        { id: "log-1", type: "log", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: "true-edge", source: "if-1", target: "log-1", sourceHandle: "true" },
        { id: "switch-edge", source: "if-1", target: "log-1", label: "case 1" },
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

  it("strips credentials and execution-only styling when stringifying graphs", () => {
    const json = stringifyGraph({
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
  });

  it("parses valid graphs and rejects invalid ones", () => {
    expect(tryParseGraphFromText("not json")).toBeNull();
    expect(tryParseGraphFromText(JSON.stringify({ nope: true }))).toBeNull();

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
