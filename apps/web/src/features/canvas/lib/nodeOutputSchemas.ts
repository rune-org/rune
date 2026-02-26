import type { NodeKind, EditData } from "../types";
import type { VariableTreeNode } from "./variableSchema";

/**
 * Returns a static output schema for a given node kind.
 * These represent the expected shape of a node's output before execution.
 */
export function getStaticOutputSchema(
  kind: NodeKind,
  data?: Record<string, unknown>,
): VariableTreeNode[] {
  switch (kind) {
    case "http":
      return [
        { key: "status", path: "status", type: "number", source: "schema" },
        { key: "statusText", path: "statusText", type: "string", source: "schema" },
        {
          key: "headers",
          path: "headers",
          type: "object",
          source: "schema",
          children: [],
        },
        {
          key: "body",
          path: "body",
          type: "object",
          source: "schema",
          children: [],
        },
      ];

    case "smtp":
      return [
        { key: "success", path: "success", type: "boolean", source: "schema" },
        { key: "message_id", path: "message_id", type: "string", source: "schema" },
      ];

    case "edit": {
      const editData = data as EditData | undefined;
      const assignments = editData?.assignments;
      if (!assignments || !Array.isArray(assignments)) return [];
      return assignments
        .filter((a) => a.name)
        .map((a) => ({
          key: a.name!,
          path: a.name!,
          type: (a.type === "number" ? "number" : a.type === "boolean" ? "boolean" : "string") as VariableTreeNode["type"],
          source: "schema" as const,
        }));
    }

    case "split":
      return [
        {
          key: "$item",
          path: "$item",
          type: "unknown",
          source: "schema",
        },
      ];

    case "trigger":
      return [];

    // Pass-through nodes: route/filter/delay without transforming data
    case "if":
    case "switch":
    case "wait":
      return [
        { key: "context", path: "context", type: "object", source: "schema", children: [] },
      ];

    case "merge":
      return [
        { key: "merged", path: "merged", type: "object", source: "schema", children: [] },
      ];

    case "aggregator":
      return [
        { key: "items", path: "items", type: "array", source: "schema", children: [] },
      ];

    case "agent":
      return [
        { key: "response", path: "response", type: "string", source: "schema" },
        { key: "usage", path: "usage", type: "object", source: "schema", children: [] },
      ];

    default:
      return [];
  }
}
