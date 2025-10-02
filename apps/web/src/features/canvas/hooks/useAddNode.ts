"use client";

import { useCallback } from "react";
import type { CanvasNode, NodeKind } from "../types";
import { createId } from "../utils/id";

export function useAddNode(
  setNodes: (
    updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[],
  ) => void,
  containerRef: React.RefObject<HTMLDivElement | null>,
  rfInstanceRef: React.RefObject<any>,
) {
  return useCallback(
    (kind: NodeKind, clientX?: number, clientY?: number) => {
      let x = 100;
      let y = 100;
      const container = containerRef.current;
      const inst = rfInstanceRef.current;
      if (
        container &&
        inst &&
        typeof clientX === "number" &&
        typeof clientY === "number"
      ) {
        const rect = container.getBoundingClientRect();
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        let p: { x: number; y: number } = { x: localX, y: localY };
        const proj =
          (inst as any).screenToFlowPosition ?? (inst as any).project;
        if (typeof proj === "function") {
          p = proj({ x: localX, y: localY });
        }
        x = p.x;
        y = p.y;
      }
      let node: CanvasNode;
      switch (kind) {
        case "if":
          node = {
            id: createId(),
            type: "if",
            position: { x, y },
            data: { label: "If", expression: "{{ var > 10 }}" },
          };
          break;
        case "http":
          node = {
            id: createId(),
            type: "http",
            position: { x, y },
            data: {
              label: "HTTP",
              method: "GET",
              url: "https://api.example.com",
            },
          };
          break;
        case "smtp":
          node = {
            id: createId(),
            type: "smtp",
            position: { x, y },
            data: { label: "SMTP", to: "user@example.com", subject: "Hello" },
          };
          break;
        case "trigger":
          node = {
            id: createId(),
            type: "trigger",
            position: { x, y },
            data: { label: "Trigger" },
          };
          break;
        case "agent":
        default:
          node = {
            id: createId(),
            type: "agent",
            position: { x, y },
            data: { label: "Agent" },
          };
      }
      setNodes((ns) => ns.concat(node));
    },
    [containerRef, rfInstanceRef, setNodes],
  );
}
