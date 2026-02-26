"use client";

import { memo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
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
import type { CanvasNode } from "../types";
import { getMiniMapNodeColor, isValidNodeKind } from "../lib/nodeRegistry";
import { ExecutionStatusBar } from "./ExecutionStatusBar";

function getNodeColor(node: { type?: string }) {
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
  onNodeDoubleClick: NonNullable<
    ReactFlowProps<CanvasNode, Edge>["onNodeDoubleClick"]
  >;
  onNodeDragStart: NonNullable<
    ReactFlowProps<CanvasNode, Edge>["onNodeDragStart"]
  >;
  onNodeDragStop: NonNullable<
    ReactFlowProps<CanvasNode, Edge>["onNodeDragStop"]
  >;
  onInit: (instance: ReactFlowInstance<CanvasNode, Edge>) => void;
  onPaneClick: () => void;
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
}: FlowViewportProps) {
  return (
    <ReactFlow
      fitView
      onlyRenderVisibleElements
      nodes={nodes}
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
    >
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

      <ExecutionStatusBar />
    </ReactFlow>
  );
});
