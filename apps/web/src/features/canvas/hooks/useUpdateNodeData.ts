"use client";

import { useCallback } from "react";
import type { CanvasNode, NodeDataMap, NodeKind } from "../types";

type SetNodes = (
  updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[],
) => void;

// Returns a typed updater that merges partial changes into a node's data
// while ensuring the updater function receives the correct data shape
// for the provided node kind.
export function useUpdateNodeData(setNodes: SetNodes) {
  return useCallback(
    function updateNodeData<T extends NodeKind>(
      id: string,
      kind: T,
      updater: (
        data: NodeDataMap[T],
      ) => Partial<NodeDataMap[T]> | NodeDataMap[T],
    ) {
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id !== id || n.type !== kind) return n;
          const next = updater(n.data as NodeDataMap[T]);
          const merged = {
            ...(n.data as object),
            ...(next as object),
          } as NodeDataMap[T];
          return { ...n, data: merged } as CanvasNode;
        }),
      );
    },
    [setNodes],
  );
}
