"use client";

import { memo, useEffect, useState } from "react";
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
import { useTheme } from "next-themes";
import { nodeTypes } from "../nodes";
import type { CanvasNode } from "../types";
import { getMiniMapNodeColor, isValidNodeKind } from "../lib/nodeRegistry";
import { ClickConnectBridge } from "./ClickConnectBridge";
import { ExecutionStatusBar } from "./ExecutionStatusBar";
import type { WsConnectionStatus } from "../hooks/useRtesWebSocket";

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
  onNodeDoubleClick: NonNullable<ReactFlowProps<CanvasNode, Edge>["onNodeDoubleClick"]>;
  onNodeDragStart: NonNullable<ReactFlowProps<CanvasNode, Edge>["onNodeDragStart"]>;
  onNodeDragStop: NonNullable<ReactFlowProps<CanvasNode, Edge>["onNodeDragStop"]>;
  onInit: (instance: ReactFlowInstance<CanvasNode, Edge>) => void;
  onPaneClick: () => void;
  readOnly?: boolean;
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
  readOnly,
  wsStatus,
  wsReconnectAttempts,
  onDismissRunning,
}: FlowViewportProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isLight = mounted && resolvedTheme !== "dark";

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
      connectOnClick={!readOnly}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
    >
      {!readOnly ? <ClickConnectBridge /> : null}

      {/* SVG defs — pencil filters + hand-drawn arrowhead (light mode only) */}
      {isLight && (
        <svg
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
          aria-hidden="true"
        >
          <defs>
            {/* Node wobble — strong displacement, large wobble like hand tremor */}
            <filter id="pencil-roughness" x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence
                type="turbulence"
                baseFrequency="0.025"
                numOctaves="4"
                seed="3"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="4.5"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>

            {/* Edge wobble — slightly milder, extra vertical headroom for diagonal lines */}
            <filter id="pencil-roughness-edges" x="-10%" y="-20%" width="120%" height="140%">
              <feTurbulence
                type="turbulence"
                baseFrequency="0.035"
                numOctaves="3"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="3"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>

            {/* Hand-drawn chevron arrowhead — open, no fill, like a quick pencil mark */}
            <marker
              id="hand-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path
                d="M 1 2 L 8 5 L 1 8"
                fill="none"
                stroke="hsl(20 8% 30%)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </marker>
          </defs>
        </svg>
      )}

      {/* Show dot grid only in dark mode; light mode uses CSS notebook paper lines */}
      {!isLight && <Background />}

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
