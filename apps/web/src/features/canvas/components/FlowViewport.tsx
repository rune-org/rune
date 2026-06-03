"use client";

import { memo, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  type Edge,
  type IsValidConnection,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnSelectionChangeParams,
  type ReactFlowProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { cn } from "@/lib/cn";
import type { CanvasNode, StickyNoteColor } from "../types";
import { getMiniMapNodeColor, isValidNodeKind } from "../lib/nodeRegistry";
import { ClickConnectBridge } from "./ClickConnectBridge";
import { ExecutionStatusBar } from "./ExecutionStatusBar";
import type { WsConnectionStatus } from "../hooks/useRtesWebSocket";

// In select mode, left-drag selects; panning moves to middle/right mouse buttons
const SELECT_MODE_PAN_BUTTONS = [1, 2];

const STICKY_NOTE_MINIMAP_COLORS: Record<StickyNoteColor, string> = {
  yellow: "#fcd34d",
  green: "#86efac",
  blue: "#7dd3fc",
  pink: "#f9a8d4",
  purple: "#c4b5fd",
  gray: "#d4d4d8",
};

function getNodeColor(node: { type?: string; data?: Record<string, unknown> }) {
  if (node.type === "stickyNote") {
    const color =
      STICKY_NOTE_MINIMAP_COLORS[node.data?.color as StickyNoteColor] ??
      STICKY_NOTE_MINIMAP_COLORS.yellow;
    return `color-mix(in srgb, ${color} 30%, transparent)`;
  }
  const type = node.type as string;
  if (isValidNodeKind(type)) {
    return getMiniMapNodeColor(type);
  }
  return "color-mix(in srgb, var(--muted) 50%, transparent)";
}

type FlowViewportProps = {
  nodes: CanvasNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: OnConnect;
  isValidConnection: IsValidConnection;
  onSelectionChange: (params: OnSelectionChangeParams) => void;
  onNodeDoubleClick: NonNullable<ReactFlowProps<CanvasNode, Edge>["onNodeDoubleClick"]>;
  onNodeDragStart: NonNullable<ReactFlowProps<CanvasNode, Edge>["onNodeDragStart"]>;
  onNodeDragStop: NonNullable<ReactFlowProps<CanvasNode, Edge>["onNodeDragStop"]>;
  onInit: (instance: ReactFlowInstance<CanvasNode, Edge>) => void;
  onPaneClick: NonNullable<ReactFlowProps<CanvasNode, Edge>["onPaneClick"]>;
  onBeforeDelete: NonNullable<ReactFlowProps<CanvasNode, Edge>["onBeforeDelete"]>;
  readOnly?: boolean;
  selectMode?: boolean;
  notePlacementMode?: boolean;
  wsStatus?: WsConnectionStatus;
  wsReconnectAttempts?: number;
  onDismissRunning?: () => void;
};

export const FlowViewport = memo(function FlowViewport({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onSelectionChange,
  onNodeDoubleClick,
  onNodeDragStart,
  onNodeDragStop,
  onInit,
  onPaneClick,
  onBeforeDelete,
  readOnly,
  selectMode,
  notePlacementMode,
  wsStatus,
  wsReconnectAttempts,
  onDismissRunning,
}: FlowViewportProps) {
  const viewportNodes = useMemo<CanvasNode[]>(() => {
    if (!readOnly) return nodes;
    return nodes.map<CanvasNode>((node) => {
      if (node.type !== "stickyNote") return node;
      return { ...node, data: { ...node.data, readOnly: true } };
    });
  }, [nodes, readOnly]);

  return (
    <ReactFlow
      fitView
      onlyRenderVisibleElements
      nodes={viewportNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={{ type: "default" }}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      onSelectionChange={onSelectionChange}
      onNodeDoubleClick={onNodeDoubleClick}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onInit={onInit}
      onPaneClick={onPaneClick}
      onBeforeDelete={onBeforeDelete}
      connectOnClick={!readOnly}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      deleteKeyCode={null}
      selectionOnDrag={selectMode}
      selectionMode={SelectionMode.Partial}
      panOnDrag={selectMode ? SELECT_MODE_PAN_BUTTONS : true}
      className={
        cn(selectMode && "canvas-select-mode", notePlacementMode && "canvas-note-placement") ||
        undefined
      }
    >
      {!readOnly ? <ClickConnectBridge /> : null}
      <Background />

      <MiniMap
        nodeBorderRadius={19}
        position="bottom-left"
        nodeColor={getNodeColor}
        nodeStrokeColor="#334155"
        maskColor="rgba(0,0,0,0.2)"
        style={{ width: 200, height: 117, opacity: 0.85 }}
      />

      <Controls style={{ height: 107, marginLeft: "222px", opacity: 0.85 }} />

      <ExecutionStatusBar
        wsStatus={wsStatus}
        wsReconnectAttempts={wsReconnectAttempts}
        onDismissRunning={onDismissRunning}
      />
    </ReactFlow>
  );
});
