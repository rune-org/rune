"use client";

import { useCallback } from "react";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "../types";
import { applyAutoLayout } from "../lib/autoLayout";

type SetNodes = (
  updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[],
) => void;

type SetEdges = (updater: (edges: Edge[]) => Edge[] | Edge[]) => void;

export interface UseAutoLayoutOptions {
  onBeforeLayout?: () => void;
}

export function useAutoLayout(
  nodes: CanvasNode[],
  edges: Edge[],
  setNodes: SetNodes,
  setEdges: SetEdges,
  options: UseAutoLayoutOptions = {},
) {
  const { onBeforeLayout } = options;

  const autoLayout = useCallback(() => {
    onBeforeLayout?.();

    const result = applyAutoLayout({
      nodes,
      edges,
      respectPinned: true,
    });

    setNodes(() => result.nodes);
    setEdges(() => result.edges);
  }, [nodes, edges, setNodes, setEdges, onBeforeLayout]);

  return { autoLayout };
}
