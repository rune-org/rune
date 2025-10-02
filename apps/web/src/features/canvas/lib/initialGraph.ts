import type { CanvasEdge, CanvasNode } from "../types";

export const initialNodes: CanvasNode[] = [
  {
    id: "trigger-1",
    type: "trigger",
    position: { x: 120, y: 120 },
    data: { label: "Start" },
  },
  {
    id: "agent-1",
    type: "agent",
    position: { x: 420, y: 180 },
    data: { label: "Agent" },
  },
];

export const initialEdges: CanvasEdge[] = [
  {
    id: "e-1",
    source: "trigger-1",
    target: "agent-1",
    type: "default",
  },
];
