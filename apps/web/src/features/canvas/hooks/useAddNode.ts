"use client";

import { useCallback } from "react";
import type { CanvasNode, NodeKind } from "../types";
import { getNodeDefaults } from "../lib/nodeRegistry";
import { createId } from "../utils/id";
import type { Edge, ReactFlowInstance } from "@xyflow/react";

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

      const defaults = getNodeDefaults(kind);

      setNodes((nodes) => {
        const baseLabel = defaults.data.label ?? "Node";
        const existingLabels = nodes
          .map((node) => node.data.label)
          .filter((label): label is string => !!label);

        let newLabel = baseLabel;
        let counter = 2;

        while (existingLabels.includes(newLabel)) {
          newLabel = `${baseLabel} ${counter}`;
          counter++;
        }

        const newNode = {
          id: createId(),
          position,
          type: defaults.type,
          data: { ...defaults.data, label: newLabel },
        } as CanvasNode;

        return nodes.concat(newNode);
      });
    },
    [containerRef, rfInstanceRef, setNodes],
  );
}
