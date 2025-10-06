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
  type ReactFlowInstance,
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
import { useConditionalConnect } from "./hooks/useConditionalConnect";
import { useUpdateNodeData } from "./hooks/useUpdateNodeData";
import { useExecutionSim } from "./hooks/useExecutionSim";

type HistoryEntry = { nodes: CanvasNode[]; edges: Edge[] };

export default function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(
    null,
  );
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);

  const onConnect = useConditionalConnect(setEdges);
  const { save } = useLocalGraph(setNodes, setEdges);
  const addNode = useAddNode(setNodes, containerRef, rfInstanceRef);
  const { run, reset } = useExecutionSim(nodes, edges, setNodes, setEdges);
  const updateNodeData = useUpdateNodeData(setNodes);

  const pushHistory = useCallback(() => {
    historyRef.current.push(structuredClone({ nodes, edges }));
  }, [nodes, edges]);

  const undo = useCallback(() => {
    const lastState = historyRef.current.pop();
    if (lastState) {
      setNodes(lastState.nodes);
      setEdges(lastState.edges);
    }
  }, [setEdges, setNodes]);

  const deleteSelectedElements = useCallback(() => {
    pushHistory();
    const selectedNodeIds = new Set(
      nodes.filter((n) => n.selected).map((n) => n.id),
    );
    setNodes((ns) => ns.filter((n) => !selectedNodeIds.has(n.id)));
    setEdges((es) =>
      es.filter(
        (e) => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target),
      ),
    );
  }, [nodes, pushHistory, setNodes, setEdges]);

  useCanvasShortcuts({
    nodes,
    edges,
    selectedNodeId,
    setNodes,
    setEdges,
    onDelete: deleteSelectedElements,
    onSave: () => save({ nodes, edges }),
    onSelectAll: (firstId) => setSelectedNodeId(firstId),
    onPushHistory: pushHistory,
  });

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const updateSelectedNodeLabel = useCallback(
    (label: string) => {
      if (!selectedNode) return;
      updateNodeData(selectedNode.id, selectedNode.type, () => ({ label }));
    },
    [selectedNode, updateNodeData],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodeId(params.nodes[0]?.id ?? null);
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <ReactFlow
        fitView
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onInit={(inst) => (rfInstanceRef.current = inst)}
        onPaneClick={() => setSelectedNodeId(null)}
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
        <Panel position="top-left" className="pointer-events-auto z-[60]">
          <div ref={toolbarRef}>
            <Toolbar
              onExecute={() => {
                reset();
                run();
              }}
              onUndo={undo}
              onDelete={deleteSelectedElements}
              onSave={() => save({ nodes, edges })}
              onFitView={() => rfInstanceRef.current?.fitView()}
            />
          </div>
        </Panel>

        {/* Inspector */}
        <Inspector
          selectedNode={selectedNode}
          updateSelectedNodeLabel={updateSelectedNodeLabel}
          updateData={updateNodeData}
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

      <Library
        containerRef={containerRef}
        toolbarRef={toolbarRef}
        onAdd={(t, x, y) => {
          pushHistory();
          addNode(t, x, y);
        }}
      />
    </div>
  );
}
