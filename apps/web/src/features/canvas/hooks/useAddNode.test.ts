import type { ReactFlowInstance } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import type { CanvasNode } from "../types";
import { calculateNodePosition } from "./useAddNode";

function createContainer(rect: Partial<DOMRect>): HTMLDivElement {
  const container = document.createElement("div");
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    left: rect.left ?? 0,
    top: rect.top ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    toJSON: () => ({}),
  } as DOMRect);
  return container;
}

function createReactFlowInstance() {
  return {
    screenToFlowPosition: vi.fn((position: { x: number; y: number }) => ({
      x: position.x / 2,
      y: position.y / 2,
    })),
  } as unknown as ReactFlowInstance<CanvasNode>;
}

describe("calculateNodePosition", () => {
  it("uses the pointer position for drag and drop", () => {
    const container = createContainer({ left: 100, top: 50, width: 800, height: 600 });
    const rfInstance = createReactFlowInstance();

    const position = calculateNodePosition(rfInstance, container, 300, 250);

    expect(rfInstance.screenToFlowPosition).toHaveBeenCalledWith({ x: 300, y: 250 });
    expect(position).toEqual({ x: 150, y: 125 });
  });

  it("uses the current viewport center when no pointer position is provided", () => {
    const container = createContainer({ left: 100, top: 50, width: 800, height: 600 });
    const rfInstance = createReactFlowInstance();

    const position = calculateNodePosition(rfInstance, container);

    expect(rfInstance.screenToFlowPosition).toHaveBeenCalledWith({ x: 500, y: 350 });
    expect(position).toEqual({ x: 250, y: 175 });
  });

  it("falls back when the canvas is not initialized", () => {
    expect(calculateNodePosition(null, null)).toEqual({ x: 100, y: 100 });
  });
});
