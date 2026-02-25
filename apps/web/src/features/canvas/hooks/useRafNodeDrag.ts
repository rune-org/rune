"use client";

import { useCallback, useEffect, useRef } from "react";
import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import type { CanvasNode } from "../types";

type SetNodes = React.Dispatch<React.SetStateAction<CanvasNode[]>>;
type UseRafNodeDragOptions = {
  onDragStateChange?: (isDragging: boolean) => void;
};

// requestAnimationFrame based dragging. We coalesce high-frequency drag position
// changes and flush them once per paint frame to keep motion visually smoother.
export function useRafNodeDrag(
  setNodes: SetNodes,
  options: UseRafNodeDragOptions = {},
) {
  const { onDragStateChange } = options;
  const pendingPositionChangesRef = useRef<NodeChange<CanvasNode>[] | null>(null);
  const positionFlushFrameRef = useRef<number | null>(null);

  const flushPositionChanges = useCallback(() => {
    const pendingChanges = pendingPositionChangesRef.current;
    pendingPositionChangesRef.current = null;
    positionFlushFrameRef.current = null;

    if (!pendingChanges || pendingChanges.length === 0) {
      return;
    }

    setNodes((currentNodes) => applyNodeChanges(pendingChanges, currentNodes));
  }, [setNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      if (changes.length === 0) {
        return;
      }

      const immediateChanges: NodeChange<CanvasNode>[] = [];
      let latestPositionChanges: NodeChange<CanvasNode>[] | null = null;

      for (const change of changes) {
        if (change.type === "position") {
          if (!latestPositionChanges) {
            latestPositionChanges = [];
          }
          latestPositionChanges.push(change);
          continue;
        }

        immediateChanges.push(change);
      }

      if (immediateChanges.length > 0) {
        if (positionFlushFrameRef.current !== null) {
          cancelAnimationFrame(positionFlushFrameRef.current);
          positionFlushFrameRef.current = null;
        }

        const pendingPositionChanges = pendingPositionChangesRef.current;
        pendingPositionChangesRef.current = null;

        setNodes((currentNodes) => {
          let nextNodes = currentNodes;

          if (pendingPositionChanges && pendingPositionChanges.length > 0) {
            nextNodes = applyNodeChanges(pendingPositionChanges, nextNodes);
          }

          return applyNodeChanges(immediateChanges, nextNodes);
        });
      }

      if (latestPositionChanges && latestPositionChanges.length > 0) {
        pendingPositionChangesRef.current = latestPositionChanges;
        if (positionFlushFrameRef.current === null) {
          positionFlushFrameRef.current = requestAnimationFrame(flushPositionChanges);
        }
      }
    },
    [flushPositionChanges, setNodes],
  );

  const onNodeDragStart = useCallback(() => {
    onDragStateChange?.(true);
  }, [onDragStateChange]);

  const onNodeDragStop = useCallback(() => {
    onDragStateChange?.(false);
    if (positionFlushFrameRef.current !== null) {
      cancelAnimationFrame(positionFlushFrameRef.current);
      positionFlushFrameRef.current = null;
    }
    flushPositionChanges();
  }, [flushPositionChanges, onDragStateChange]);

  useEffect(() => {
    return () => {
      if (positionFlushFrameRef.current !== null) {
        cancelAnimationFrame(positionFlushFrameRef.current);
      }
    };
  }, []);

  return {
    onNodesChange,
    onNodeDragStart,
    onNodeDragStop,
  };
}
