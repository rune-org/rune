"use client";

import { useCallback } from "react";
import type { CanvasNode } from "../types";

type SetNodes = (
  updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[],
) => void;

export function usePinNode(setNodes: SetNodes) {
  const togglePin = useCallback(
    (nodeId: string) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  pinned: !node.data.pinned,
                },
              }
            : node,
        ) as CanvasNode[],
      );
    },
    [setNodes],
  );

  const pinNode = useCallback(
    (nodeId: string) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  pinned: true,
                },
              }
            : node,
        ) as CanvasNode[],
      );
    },
    [setNodes],
  );

  const unpinNode = useCallback(
    (nodeId: string) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  pinned: false,
                },
              }
            : node,
        ) as CanvasNode[],
      );
    },
    [setNodes],
  );

  const unpinAll = useCallback(() => {
    setNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          pinned: false,
        },
      })) as CanvasNode[],
    );
  }, [setNodes]);

  return {
    togglePin,
    pinNode,
    unpinNode,
    unpinAll,
  };
}
