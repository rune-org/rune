"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  Panel,
  type Edge,
  OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./styles/reactflow.css";

import { initialEdges, initialNodes } from "./lib/initialGraph";
import { nodeTypes } from "./nodes";
import type { CanvasNode } from "./types";
import { Toolbar } from "./components/Toolbar";
import { Inspector } from "./components/Inspector";
import { Library } from "./components/Library";
import { useLocalGraph } from "./hooks/useLocalGraph";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";
import { useAddNode } from "./hooks/useAddNode";
import { useColoredConnect } from "./hooks/useColoredConnect";
import { useUpdateNodeData } from "./hooks/useUpdateNodeData";

export default function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<any>(null);

  const onConnect = useColoredConnect(setEdges);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const first = params.nodes?.[0];
    setSelectedNodeId(first ? (first.id as string) : null);
  }, []);

  const { save } = useLocalGraph(setNodes, setEdges);

  useCanvasShortcuts({
    nodes,
    edges,
    selectedNodeId,
    setNodes,
    setEdges,
    onSave: () => save({ nodes, edges }),
    onSelectAll: (firstId) => setSelectedNodeId(firstId),
  });

  const addNode = useAddNode(setNodes, containerRef, rfInstanceRef);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );
  const updateNodeData = useUpdateNodeData(setNodes);

  const updateSelectedNodeLabel = useCallback(
    (value: string) => {
      if (!selectedNode) return;
      // Use typed helper to update label according to node kind
      updateNodeData(selectedNode.id, selectedNode.type, (d) => ({
        ...d,
        label: value,
      }));
    },
    [selectedNode, updateNodeData],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <ReactFlow
        fitView
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onInit={(inst) => (rfInstanceRef.current = inst)}
        onPaneClick={() => setSelectedNodeId(null)}
        nodeTypes={nodeTypes}
      >
        <Background />
        <MiniMap
          nodeColor={() =>
            getComputedStyle(document.documentElement).getPropertyValue(
              "--secondary",
            ) || "#1f2937"
          }
          nodeStrokeColor={() =>
            getComputedStyle(document.documentElement).getPropertyValue(
              "--border",
            ) || "#334155"
          }
          maskColor="rgba(0,0,0,0.3)"
        />
        <Controls />

        {/* Toolbar */}
        <Panel position="top-left" className="pointer-events-auto">
          <Toolbar onAdd={addNode} />
        </Panel>

        {/* Inspector */}
        <Inspector
          selectedNode={selectedNode}
          setNodes={setNodes}
          updateSelectedNodeLabel={updateSelectedNodeLabel}
        />

        {/* Hints */}
        <Panel
          position="bottom-center"
          className="pointer-events-none !bottom-4 !right-auto !left-1/2 !-translate-x-2"
        >
          <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            Drag to move • Connect via handles • Cmd/Ctrl+S saves
          </div>
        </Panel>
      </ReactFlow>

      <Library containerRef={containerRef} onAdd={addNode} />
    </div>
  );
}
