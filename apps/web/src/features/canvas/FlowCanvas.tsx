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
import { useExecutionSim } from "./hooks/useExecutionSim";

export default function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<CanvasNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<any>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const onConnect = useColoredConnect(setEdges);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const first = params.nodes?.[0];
    setSelectedNodeId(first ? (first.id as string) : null);
  }, []);

  const { save } = useLocalGraph(setNodes, setEdges);

  // TODO: improve history (undo) to be more robust
  const historyRef = useRef<{ nodes: CanvasNode[]; edges: Edge[] }[]>([]);
  const pushHistory = useCallback(() => {
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
  }, [nodes, edges]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.length) return;
    const last = h.pop()!;
    setNodes(last.nodes as any);
    setEdges(last.edges as any);
  }, [setEdges, setNodes]);

  useCanvasShortcuts({
    nodes,
    edges,
    selectedNodeId,
    setNodes,
    setEdges,
    onSave: () => save({ nodes, edges }),
    onSelectAll: (firstId) => setSelectedNodeId(firstId),
    onPushHistory: pushHistory,
  });

  const addNode = useAddNode(setNodes, containerRef, rfInstanceRef);

  // execution simulator
  // TODO: implement execution logic for real.
  const { run, reset } = useExecutionSim(nodes, edges, setNodes, setEdges);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );
  const updateNodeData = useUpdateNodeData(setNodes);

  const updateSelectedNodeLabel = useCallback(
    (value: string) => {
      if (!selectedNode) return;
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
        <Panel position="top-left" className="pointer-events-auto z-[60]">
          <div ref={toolbarRef} className="inline-flex">
          <Toolbar
            onExecute={() => {
              reset();
              run();
            }}
            onUndo={undo}
            onDelete={() => {
              const selectedNodeIds = new Set(
                nodes.filter((n) => n.selected).map((n) => n.id),
              );
              const selectedEdgeIds = new Set(
                edges.filter((e) => (e as any).selected).map((e) => e.id as string),
              );
              if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0 && selectedNodeId)
                selectedNodeIds.add(selectedNodeId);
              if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;
              pushHistory();
              setNodes((ns) => ns.filter((n) => !selectedNodeIds.has(n.id)));
              setEdges((es) =>
                es.filter(
                  (ed) =>
                    !selectedEdgeIds.has(ed.id as string) &&
                    !selectedNodeIds.has(ed.source as string) &&
                    !selectedNodeIds.has(ed.target as string),
                ),
              );
            }}
            onSave={() => save({ nodes, edges })}
            onFitView={() => rfInstanceRef.current?.fitView?.()}
          />
          </div>
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
