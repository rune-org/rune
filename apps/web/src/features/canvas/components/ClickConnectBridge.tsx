"use client";

import { useEffect } from "react";
import { useStore, useStoreApi, Position } from "@xyflow/react";

const OPPOSITE: Record<string, Position> = {
  [Position.Left]: Position.Right,
  [Position.Right]: Position.Left,
  [Position.Top]: Position.Bottom,
  [Position.Bottom]: Position.Top,
};

export function ClickConnectBridge() {
  const store = useStoreApi();
  const clickStartHandle = useStore((s) => s.connectionClickStartHandle);

  useEffect(() => {
    if (!clickStartHandle) return;

    const { nodeLookup, connectionMode, domNode, updateConnection, cancelConnection } =
      store.getState();

    if (!domNode) return;

    const node = nodeLookup.get(clickStartHandle.nodeId);
    if (!node) return;

    const bounds =
      connectionMode === "strict"
        ? node.internals.handleBounds?.[clickStartHandle.type]
        : [
            ...(node.internals.handleBounds?.source ?? []),
            ...(node.internals.handleBounds?.target ?? []),
          ];

    const handle = clickStartHandle.id
      ? bounds?.find((h) => h.id === clickStartHandle.id)
      : bounds?.[0];
    if (!handle) return;

    const fromHandle = { ...handle, nodeId: clickStartHandle.nodeId, type: clickStartHandle.type };
    const fromPosition = handle.position ?? Position.Left;
    const toPosition = OPPOSITE[fromPosition] ?? Position.Right;

    const abort = () => {
      cancelConnection();
      store.setState({ connectionClickStartHandle: null });
    };

    type ConnectionUpdate = Parameters<typeof updateConnection>[0];

    function makeUpdate(to: { x: number; y: number }, fromNode: typeof node): ConnectionUpdate {
      const from = {
        x: (handle!.x ?? 0) + fromNode!.internals.positionAbsolute.x + (handle!.width ?? 1) / 2,
        y: (handle!.y ?? 0) + fromNode!.internals.positionAbsolute.y + (handle!.height ?? 1) / 2,
      };
      return {
        inProgress: true,
        isValid: null,
        from,
        fromHandle,
        fromPosition,
        fromNode,
        to,
        toHandle: null,
        toPosition,
        toNode: null,
        pointer: to,
      } as ConnectionUpdate;
    }

    const from = {
      x: (handle.x ?? 0) + node.internals.positionAbsolute.x + (handle.width ?? 1) / 2,
      y: (handle.y ?? 0) + node.internals.positionAbsolute.y + (handle.height ?? 1) / 2,
    };
    updateConnection(makeUpdate(from, node));

    let rafId = 0;

    const onMouseMove = (event: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { connectionClickStartHandle: csh, nodeLookup: nl } = store.getState();
        if (!csh) return;

        const rect = domNode!.getBoundingClientRect();
        const position = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const currentNode = nl.get(clickStartHandle.nodeId) ?? node;

        updateConnection(makeUpdate(position, currentNode));
      });
    };

    const onDocClick = (event: MouseEvent) => {
      if (!store.getState().connectionClickStartHandle) return;
      if ((event.target as HTMLElement).closest(".react-flow__handle")) return;
      abort();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") abort();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
      abort();
    };
  }, [clickStartHandle, store]);

  return null;
}
