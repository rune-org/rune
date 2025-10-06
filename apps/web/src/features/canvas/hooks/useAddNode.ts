"use client";

import { useCallback } from "react";
import type { CanvasNode, NodeKind, NodeDataMap } from "../types";
import { createId } from "../utils/id";
import type { Edge, ReactFlowInstance } from "@xyflow/react";

/** Defines the default data for each node type. */
const NODE_DEFAULTS: Record<
  NodeKind,
  { type: NodeKind; data: NodeDataMap[NodeKind] }
> = {
  trigger: {
    type: "trigger",
    data: { label: "Trigger" },
  },
  agent: {
    type: "agent",
    data: { label: "Agent" },
  },
  if: {
    type: "if",
    data: { label: "If", expression: "{{ var > 10 }}" },
  },
  http: {
    type: "http",
    data: { label: "HTTP", method: "GET", url: "https://api.example.com" },
  },
  smtp: {
    type: "smtp",
    data: { label: "SMTP", to: "user@example.com", subject: "Hello" },
  },
};

// Helper function to calculate the node's position.
function calculateNodePosition(
  rfInstance: ReactFlowInstance<CanvasNode, Edge> | null,
  container: HTMLDivElement | null,
  clientX?: number,
  clientY?: number,
) {
  if (
    container &&
    rfInstance &&
    typeof clientX === "number" &&
    typeof clientY === "number"
  ) {
    const rect = container.getBoundingClientRect();
    const position = rfInstance.screenToFlowPosition({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
    return position;
  }
  return { x: 100, y: 100 };
}

export function useAddNode(
  setNodes: (
    updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[],
  ) => void,
  containerRef: React.RefObject<HTMLDivElement | null>,
  rfInstanceRef: React.RefObject<ReactFlowInstance<CanvasNode, Edge> | null>,
) {
  return useCallback(
    (kind: NodeKind, clientX?: number, clientY?: number) => {
      const position = calculateNodePosition(
        rfInstanceRef.current,
        containerRef.current,
        clientX,
        clientY,
      );

      const defaults = NODE_DEFAULTS[kind];

      const newNode: CanvasNode = {
        id: createId(),
        position,
        ...defaults,
      };

      setNodes((nodes) => nodes.concat(newNode));
    },
    [containerRef, rfInstanceRef, setNodes],
  );
}
