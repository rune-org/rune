import type { CanvasEdge, CanvasNode } from "../types";

export const initialNodes: CanvasNode[] = [
  {
    id: "trgr-1",
    type: "trigger",
    position: { x: 120, y: 120 },
    data: { label: "Start" },
  },
  {
    id: "agnt-1",
    type: "agent",
    position: { x: 420, y: 180 },
    data: { label: "Agent" },
  },
];

export const initialEdges: CanvasEdge[] = [
  {
    id: "edge-1",
    source: "trgr-1",
    target: "agnt-1",
    type: "default",
  },
];
