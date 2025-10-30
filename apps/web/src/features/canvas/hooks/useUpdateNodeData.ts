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
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id !== id || n.type !== kind) {
            return n;
          }
          // The new data is a shallow merge of the old and the new partial data
          const nextData: NodeDataMap[T] = {
            ...n.data,
            ...updater(n.data as NodeDataMap[T]),
          } as NodeDataMap[T];

          return { ...n, data: nextData } as CanvasNode;
        }),
      );
    },
    [setNodes],
  );
}
