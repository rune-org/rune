"use client";

import { useCallback } from "react";
import type { CanvasNode, NodeKind } from "../types";
import { getNodeDefaults } from "../lib/nodeRegistry";
import { createId } from "../utils/id";
import { sanitizeNodeLabel } from "../utils/nodeLabels";
import type { Edge, ReactFlowInstance } from "@xyflow/react";

// Helper function to calculate the node's position.
export function calculateNodePosition(
  rfInstance: ReactFlowInstance<CanvasNode, Edge> | null,
  container: HTMLDivElement | null,
  clientX?: number,
  clientY?: number,
) {
  if (container && rfInstance) {
    const rect = container.getBoundingClientRect();
    const x = typeof clientX === "number" ? clientX - rect.left : rect.width / 2;
    const y = typeof clientY === "number" ? clientY - rect.top : rect.height / 2;
    const position = rfInstance.screenToFlowPosition({
      x,
      y,
    });
    return position;
  }
  return { x: 100, y: 100 };
}

export function useAddNode(
  setNodes: (updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[]) => void,
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
        const baseLabel = sanitizeNodeLabel(defaults.data.label ?? "Node", "Node");
        const existingLabels = nodes
          .map((node) => node.data.label)
          .filter((label): label is string => !!label);

        let newLabel = baseLabel;
        let counter = 2;

        while (existingLabels.includes(newLabel)) {
          newLabel = `${baseLabel}_${counter}`;
          counter++;
        }

        const nodeData =
          kind === "webhookTrigger" && !("webhookGuid" in defaults.data)
            ? { ...defaults.data, webhookGuid: createId() }
            : defaults.data;

        const newNode = {
          id: createId(),
          position,
          type: defaults.type,
          data: { ...nodeData, label: newLabel },
        } as CanvasNode;

        return nodes.concat(newNode);
      });
    },
    [containerRef, rfInstanceRef, setNodes],
  );
}
