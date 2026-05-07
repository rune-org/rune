import { describe, expect, it } from "vitest";

import { sanitizeGraph, stringifyGraph, stripExecutionStyling, tryParseGraphFromText } from "./graphIO";
import { SWITCH_FALLBACK_HANDLE_ID } from "../utils/switchHandles";

describe("graphIO", () => {
  it("keeps valid branches in a multi-node workflow while dropping invalid graph state", () => {
    const parsed = tryParseGraphFromText(
      JSON.stringify({
        nodes: [
          { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: {} },
          { id: "if-1", type: "if", position: { x: 200, y: 0 }, data: {} },
          { id: "switch-1", type: "switch", position: { x: 400, y: 0 }, data: {} },
          { id: "log-ok", type: "log", position: { x: 600, y: -120 }, data: {} },
          { id: "log-fail", type: "log", position: { x: 600, y: 120 }, data: {} },
          { id: "unsafe-node", type: "mystery", position: { x: 800, y: 0 }, data: {} },
          { id: 123, type: "log", position: { x: 1000, y: 0 }, data: {} },
        ],
        edges: [
          { id: "e-1", source: "trigger-1", target: "if-1" },
          { id: "e-2", source: "if-1", target: "switch-1", sourceHandle: "true" },
          { id: "e-3", source: "if-1", target: "log-fail", sourceHandle: "false" },
          { id: "e-4", source: "switch-1", target: "log-ok", label: "case 1" },
          { id: "e-5", source: "switch-1", target: "log-fail", sourceHandle: SWITCH_FALLBACK_HANDLE_ID },
          { id: "e-6", source: "switch-1", target: "unsafe-node", sourceHandle: "switch-case-1" },
          { id: "e-7", source: "ghost", target: "log-ok" },
          { id: null, source: "if-1", target: "log-ok" },
        ],
      }),
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.nodes.map((node) => node.id)).toEqual([
      "trigger-1",
      "if-1",
      "switch-1",
      "log-ok",
      "log-fail",
    ]);
    expect(parsed?.edges.map((edge) => edge.id)).toEqual(["e-1", "e-2", "e-3", "e-4", "e-5"]);
    expect(parsed?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "e-2", sourceHandle: "true", label: "true" }),
        expect.objectContaining({ id: "e-3", sourceHandle: "false", label: "false" }),
        expect.objectContaining({ id: "e-4", sourceHandle: "switch-case-0", label: "case 1" }),
        expect.objectContaining({
          id: "e-5",
          sourceHandle: SWITCH_FALLBACK_HANDLE_ID,
          label: "fallback",
        }),
      ]),
    );
  });

  it("stringifyGraph strips sensitive and runtime-only execution fields without mutating input", () => {
    const graph = {
      nodes: [
        {
          id: "smtp-1",
          type: "smtp",
          position: { x: 0, y: 0 },
          data: { credential: { id: "cred-1" }, webhookGuid: "hook-guid", label: "SMTP" },
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
          data: { credential: { id: "cred-1" }, webhookGuid: "hook-guid", label: "SMTP" },
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

  it("rejects malformed graph payloads", () => {
    expect(tryParseGraphFromText("not json")).toBeNull();
    expect(tryParseGraphFromText(JSON.stringify({ nope: true }))).toBeNull();
    expect(tryParseGraphFromText(JSON.stringify({ nodes: {}, edges: [] }))).toBeNull();
    expect(tryParseGraphFromText(JSON.stringify({ nodes: [], edges: {} }))).toBeNull();
  });

  it("sanitizes valid payload and strips runtime styling from edges", () => {
    expect(
      tryParseGraphFromText(
        JSON.stringify({
          nodes: [
            { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: {} },
            {
              id: "webhook-1",
              type: "webhookTrigger",
              position: { x: 100, y: 0 },
              data: {},
            },
          ],
          edges: [],
        }),
      ),
    ).toEqual({
      nodes: [
        { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: {} },
        {
          id: "webhook-1",
          type: "webhookTrigger",
          position: { x: 100, y: 0 },
          data: { webhookGuid: expect.any(String) },
        },
      ],
      edges: [],
    });

    expect(
      stripExecutionStyling({
        nodes: [],
        edges: [{ id: "edge-1", source: "a", target: "b", animated: true }],
      }),
    ).toEqual({ nodes: [], edges: [{ id: "edge-1", source: "a", target: "b" }] });
  });

  it("sanitizeGraph defaults edge type to default for simple valid links", () => {
    expect(
      sanitizeGraph({
        nodes: [
          { id: "a", type: "trigger", position: { x: 0, y: 0 }, data: {} },
          { id: "b", type: "log", position: { x: 100, y: 0 }, data: {} },
        ],
        edges: [{ id: "simple", source: "a", target: "b" }],
      }),
    ).toEqual({
      nodes: [
        { id: "a", type: "trigger", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "log", position: { x: 100, y: 0 }, data: {} },
      ],
      edges: [expect.objectContaining({ id: "simple", source: "a", target: "b", type: "default" })],
    });
  });

  it("round-trips a branched workflow through export/import without reintroducing dropped unsafe links", () => {
    const exported = stringifyGraph({
      nodes: [
        { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: {} },
        { id: "if-1", type: "if", position: { x: 200, y: 0 }, data: {} },
        { id: "ok-1", type: "log", position: { x: 400, y: -100 }, data: {} },
        { id: "bad-1", type: "log", position: { x: 400, y: 100 }, data: {} },
        { id: "unsafe", type: "unknown-node", position: { x: 600, y: 0 }, data: {} },
      ],
      edges: [
        { id: "edge-1", source: "trigger-1", target: "if-1" },
        { id: "edge-2", source: "if-1", target: "ok-1", sourceHandle: "true" },
        { id: "edge-3", source: "if-1", target: "bad-1", sourceHandle: "false" },
        { id: "edge-4", source: "if-1", target: "unsafe", sourceHandle: "true" },
      ],
    });

    const parsed = tryParseGraphFromText(exported);
    expect(parsed).not.toBeNull();
    expect(parsed?.nodes.map((node) => node.id)).toEqual(["trigger-1", "if-1", "ok-1", "bad-1"]);
    expect(parsed?.edges.map((edge) => edge.id)).toEqual(["edge-1", "edge-2", "edge-3"]);
    expect(parsed?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "edge-2", sourceHandle: "true", label: "true" }),
        expect.objectContaining({ id: "edge-3", sourceHandle: "false", label: "false" }),
      ]),
    );
  });
});
