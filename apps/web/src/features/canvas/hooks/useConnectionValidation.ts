import { useCallback } from "react";
import type { Edge, Connection } from "@xyflow/react";
import type { CanvasNode } from "../types";
import {
  switchFallbackHandleId,
  switchRuleHandleId,
} from "../utils/switchHandles";

export function useConnectionValidation(opts: {
  nodes: CanvasNode[];
  edges: Edge[];
}): (connection: Edge | Connection) => boolean {
  const { nodes, edges } = opts;

  return useCallback(
    (connection: Edge | Connection) => {
      const { source, target, sourceHandle } = connection;

      if (source === target) return false;

      const sourceNode = nodes.find((node) => node.id === source);
      const targetNode = nodes.find((node) => node.id === target);
      if (!sourceNode || !targetNode) return false;

      const existingSourceEdges = edges.filter((edge) => edge.source === source);

      // For "if" nodes: allow max 1 edge per output handle (true/false)
      if (sourceNode.type === "if") {
        const hasEdgeFromHandle = existingSourceEdges.some(
          (edge) => edge.sourceHandle === sourceHandle
        );
        return !hasEdgeFromHandle;
      }

      if (sourceNode.type === "switch") {
        const rules = Array.isArray(sourceNode.data.rules)
          ? sourceNode.data.rules
          : [];
        const allowedHandles = new Set<string>([
          ...rules.map((_, idx) => switchRuleHandleId(idx)),
          switchFallbackHandleId(),
        ]);
        if (!sourceHandle || !allowedHandles.has(String(sourceHandle))) return false;
        const hasEdgeFromHandle = existingSourceEdges.some(
          (edge) => edge.sourceHandle === sourceHandle,
        );
        return !hasEdgeFromHandle;
      }

      // For all other nodes: allow max 1 outgoing edge
      return existingSourceEdges.length === 0;
    },
    [nodes, edges]
  );
}
