"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Start with an empty canvas by default
import { nodeTypes } from "./nodes";
import type { CanvasNode } from "./types";
import { Toolbar } from "./components/Toolbar";
import { Inspector } from "./components/Inspector";
import { Library } from "./components/Library";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";
import { useAddNode } from "./hooks/useAddNode";
import { useConditionalConnect } from "./hooks/useConditionalConnect";
import { useUpdateNodeData } from "./hooks/useUpdateNodeData";
import { useExecutionSim } from "./hooks/useExecutionSim";
import { stringifyGraph, tryParseGraphFromText } from "./lib/graphIO";
import { toast } from "@/components/ui/toast";

type HistoryEntry = { nodes: CanvasNode[]; edges: Edge[] };

export default function FlowCanvas({
  externalNodes,
  externalEdges,
  onPersist,
  onRun,
  saveDisabled = false,
}: {
  externalNodes?: CanvasNode[];
  externalEdges?: Edge[];
  onPersist?: (graph: {
    nodes: CanvasNode[];
    edges: Edge[];
  }) => Promise<void> | void;
  onRun?: () => Promise<void> | void;
  saveDisabled?: boolean;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(
    externalNodes && externalNodes.length ? externalNodes : [],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    externalEdges && externalEdges.length ? externalEdges : [],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(
    null,
  );
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);

  const onConnect = useConditionalConnect(setEdges);
  const addNode = useAddNode(setNodes, containerRef, rfInstanceRef);
  const { run, reset } = useExecutionSim(nodes, edges, setNodes, setEdges);
  const updateNodeData = useUpdateNodeData(setNodes);

  const persistGraph = useCallback(() => {
    if (!onPersist) return;
    return onPersist({ nodes, edges });
  }, [onPersist, nodes, edges]);

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
    onSave: () => {
      void persistGraph();
    },
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

  // If external graph changes, hydrate the canvas
  useEffect(() => {
    setNodes(externalNodes ?? []);
    setEdges(externalEdges ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalNodes, externalEdges]);

  // Paste to import graph DSL
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text");
      if (!text) return;
      const parsed = tryParseGraphFromText(text);
      if (!parsed) return; // ignore other content
      e.preventDefault();
      pushHistory();
      setNodes(parsed.nodes as CanvasNode[]);
      setEdges(parsed.edges as Edge[]);
      toast.success("Imported workflow from clipboard");
    };
    const el = containerRef.current ?? window;
    el.addEventListener("paste", handler as EventListener);
    return () => el.removeEventListener("paste", handler as EventListener);
  }, [pushHistory, setNodes, setEdges]);

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
                void run();
                if (onRun) void onRun();
              }}
              onUndo={undo}
              onDelete={deleteSelectedElements}
              onSave={async () => {
                await persistGraph();
              }}
              onExport={async () => {
                await navigator.clipboard.writeText(
                  stringifyGraph({ nodes, edges }),
                );
                toast.success("Exported JSON to clipboard");
              }}
              onFitView={() => rfInstanceRef.current?.fitView()}
              saveDisabled={saveDisabled}
            />
          </div>
        </Panel>

        {/* Inspector */}
        <Inspector
          selectedNode={selectedNode}
          updateSelectedNodeLabel={updateSelectedNodeLabel}
          updateData={updateNodeData}
          onDelete={selectedNode ? deleteSelectedElements : undefined}
        />

        {/* Hints */}
        <Panel
          position="bottom-center"
          className="pointer-events-none !bottom-4 !right-auto !left-1/2 !-translate-x-2"
        >
          <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            Drag to move • Connect via handles • Paste JSON to import
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

      {null}
    </div>
  );
}
