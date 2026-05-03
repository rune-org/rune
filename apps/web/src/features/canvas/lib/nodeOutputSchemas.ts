import type { EditData, NodeKind } from "../types";
import { isIntegrationNodeKind } from "../integrations/helpers";
import type { VariableTreeNode } from "./variableSchema";

/**
 * Returns a static output schema for a given node kind.
 * These represent the expected shape of a node's output before execution.
 */
export function getStaticOutputSchema(
  kind: NodeKind,
  data?: Record<string, unknown>,
): VariableTreeNode[] {
  if (isIntegrationNodeKind(kind)) {
    return [{ key: "data", path: "data", type: "object", source: "schema", children: [] }];
  }

  switch (kind) {
    case "http":
      return [
        { key: "status", path: "status", type: "number", source: "schema" },
        { key: "status_text", path: "status_text", type: "string", source: "schema" },
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
        { key: "duration_ms", path: "duration_ms", type: "number", source: "schema" },
      ];

    case "smtp":
      return [
        { key: "success", path: "success", type: "boolean", source: "schema" },
        { key: "message_id", path: "message_id", type: "string", source: "schema" },
      ];

    case "log":
      return [
        { key: "message", path: "message", type: "string", source: "schema" },
        { key: "level", path: "level", type: "string", source: "schema" },
        { key: "logged_at", path: "logged_at", type: "string", source: "schema" },
      ];

    case "dateTimeNow":
    case "dateTimeAdd":
    case "dateTimeSubtract":
    case "dateTimeFormat":
      return [
        { key: "result", path: "result", type: "string", source: "schema" },
        { key: "iso", path: "iso", type: "string", source: "schema" },
        { key: "unix", path: "unix", type: "number", source: "schema" },
        { key: "timezone", path: "timezone", type: "string", source: "schema" },
      ];

    case "dateTimeParse":
      return [
        { key: "unix", path: "unix", type: "number", source: "schema" },
        { key: "iso", path: "iso", type: "string", source: "schema" },
        { key: "year", path: "year", type: "number", source: "schema" },
        { key: "month", path: "month", type: "number", source: "schema" },
        { key: "day", path: "day", type: "number", source: "schema" },
        { key: "hour", path: "hour", type: "number", source: "schema" },
        { key: "minute", path: "minute", type: "number", source: "schema" },
        { key: "second", path: "second", type: "number", source: "schema" },
        { key: "weekday", path: "weekday", type: "string", source: "schema" },
        { key: "timezone", path: "timezone", type: "string", source: "schema" },
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
          type: (a.type === "number"
            ? "number"
            : a.type === "boolean"
              ? "boolean"
              : "string") as VariableTreeNode["type"],
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

    case "if":
      return [
        { key: "result", path: "result", type: "boolean", source: "schema" },
        { key: "expression", path: "expression", type: "string", source: "schema" },
      ];

    case "switch":
      return [
        { key: "output_index", path: "output_index", type: "number", source: "schema" },
        {
          key: "matched_rule",
          path: "matched_rule",
          type: "object",
          source: "schema",
          children: [],
        },
        { key: "fallback", path: "fallback", type: "boolean", source: "schema" },
      ];

    case "wait":
      return [
        { key: "resume_at", path: "resume_at", type: "number", source: "schema" },
        { key: "timer_id", path: "timer_id", type: "string", source: "schema" },
      ];

    case "merge":
      return [
        {
          key: "merged_context",
          path: "merged_context",
          type: "object",
          source: "schema",
          children: [],
        },
      ];

    case "filter":
    case "limit":
      return [
        { key: "count", path: "count", type: "number", source: "schema" },
        { key: "original_count", path: "original_count", type: "number", source: "schema" },
      ];

    case "sort":
      return [{ key: "count", path: "count", type: "number", source: "schema" }];

    case "aggregator":
      return [
        { key: "aggregated", path: "aggregated", type: "array", source: "schema", children: [] },
      ];

    default:
      return [];
  }
}
