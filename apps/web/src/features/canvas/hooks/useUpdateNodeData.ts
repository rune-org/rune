"use client";

import { useCallback } from "react";
import type { CanvasNode, NodeDataMap, NodeKind } from "../types";

type SetNodes = (
  updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[],
) => void;

export function useUpdateNodeData(setNodes: SetNodes) {
  return useCallback(
    function updateNodeData<T extends NodeKind>(
      id: string,
      kind: T,
      // The updater returns a partial object of changes
      updater: (data: NodeDataMap[T]) => Partial<NodeDataMap[T]>,
    ) {
      setNodes((nodes) => {
        // Collect all existing labels from other nodes
        const existingLabels = nodes
          .filter((n) => n.id !== id)
          .map((n) => n.data.label)
          .filter((label): label is string => !!label);

        return nodes.map((n) => {
          if (n.id !== id || n.type !== kind) {
            return n;
          }

          // Get the updated data
          const updates = updater(n.data as NodeDataMap[T]);
          let nextData: NodeDataMap[T] = {
            ...n.data,
            ...updates,
          } as NodeDataMap[T];

          // If label was updated, ensure it's unique
          if (updates.label !== undefined && typeof updates.label === "string") {
            let newLabel = updates.label;
            let counter = 2;

            while (existingLabels.includes(newLabel)) {
              newLabel = `${updates.label} ${counter}`;
              counter++;
            }

            nextData = { ...nextData, label: newLabel } as NodeDataMap[T];
          }

          return { ...n, data: nextData } as CanvasNode;
        });
      });
    },
    [setNodes],
  );
}
