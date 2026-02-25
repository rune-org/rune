import { useCallback, useEffect, useRef } from "react";
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
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  return useCallback(
    (connection: Edge | Connection) => {
      const { source, target, sourceHandle } = connection;
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;

      if (source === target) return false;

      const sourceNode = currentNodes.find((node) => node.id === source);
      const targetNode = currentNodes.find((node) => node.id === target);
      if (!sourceNode || !targetNode) return false;

      const existingSourceEdges = currentEdges.filter((edge) => edge.source === source);

      // For "if" nodes: allow max 1 edge per output handle (true/false)
      if (sourceNode.type === "if") {
        return !existingSourceEdges.some(
          (edge) => edge.sourceHandle === sourceHandle
        );
      }

      // For "switch" nodes: validate handle exists, then max 1 edge per handle
      if (sourceNode.type === "switch") {
        const rules = Array.isArray(sourceNode.data.rules)
          ? sourceNode.data.rules
          : [];
        const allowedHandles = new Set<string>([
          ...rules.map((_, idx) => switchRuleHandleId(idx)),
          switchFallbackHandleId(),
        ]);
        if (!sourceHandle || !allowedHandles.has(String(sourceHandle))) return false;
        return !existingSourceEdges.some(
          (edge) => edge.sourceHandle === sourceHandle,
        );
      }

      // For all other nodes: allow max 1 outgoing edge
      return existingSourceEdges.length === 0;
    },
    []
  );
}
