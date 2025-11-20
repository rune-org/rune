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
import { sanitizeGraph, stringifyGraph } from "./lib/graphIO";
import { toast } from "@/components/ui/toast";
import { createId } from "./utils/id";

type HistoryEntry = { nodes: CanvasNode[]; edges: Edge[] };
const CLIPBOARD_SELECTION_TYPE = "rune.canvas.selection";
const PASTE_OFFSET = 32;
const MAX_HISTORY_SIZE = 50;

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
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(false);

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
    if (historyRef.current.length > MAX_HISTORY_SIZE) {
      historyRef.current.shift();
    }
  }, [nodes, edges]);

  const copySelection = useCallback(async () => {
    const selectedNodeIds = new Set(
      nodes.filter((n) => n.selected).map((n) => n.id),
    );
    if (selectedNodeIds.size === 0 && selectedNodeId) {
      selectedNodeIds.add(selectedNodeId);
    }

    if (selectedNodeIds.size === 0) {
      return;
    }

    const selectedNodes = nodes
      .filter((n) => selectedNodeIds.has(n.id))
      .map((n) => structuredClone(n));

    const selectedEdges = edges
      .filter(
        (e) =>
          selectedNodeIds.has(e.source as string) &&
          selectedNodeIds.has(e.target as string),
      )
      .map((e) => structuredClone(e));

    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard permissions are required to copy");
      return;
    }

    const payload = {
      __runeClipboardType: CLIPBOARD_SELECTION_TYPE,
      nodes: selectedNodes,
      edges: selectedEdges,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Copied selection to clipboard");
    } catch {
      toast.error("Unable to copy selection");
    }
  }, [edges, nodes, selectedNodeId]);

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
    onUndo: () => {
      void undo();
    },
    onCopy: () => {
      void copySelection();
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

  // Paste to import graph DSL or clone selections
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text");
      if (!text) return;
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return;
      }

      if (!raw || typeof raw !== "object") return;

      const candidate = raw as {
        __runeClipboardType?: string;
        nodes?: unknown;
        edges?: unknown;
      };

      if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
        return;
      }

      const clipboardType = candidate.__runeClipboardType ?? null;
      const parsed = sanitizeGraph({
        nodes: candidate.nodes as CanvasNode[],
        edges: candidate.edges as Edge[],
      });

      // For DSL imports, ignore if parsed graph is empty to prevent
      // accidentally clearing the canvas.
      if (clipboardType !== CLIPBOARD_SELECTION_TYPE && parsed.nodes.length === 0) {
        return;
      }

      if (clipboardType === CLIPBOARD_SELECTION_TYPE) {
        e.preventDefault();
        pushHistory();

        const idMap = new Map<string, string>();
        const pastedNodes = (parsed.nodes as CanvasNode[]).map((node) => {
          const newId = createId();
          idMap.set(node.id, newId);
          return {
            ...node,
            id: newId,
            selected: true,
            position: {
              x: (node.position?.x ?? 0) + PASTE_OFFSET,
              y: (node.position?.y ?? 0) + PASTE_OFFSET,
            },
          } satisfies CanvasNode;
        });

        const pastedEdges = (parsed.edges as Edge[])
          .map((edge) => {
            const newSource = idMap.get(edge.source as string);
            const newTarget = idMap.get(edge.target as string);
            if (!newSource || !newTarget) return null;
            return {
              ...edge,
              id: createId(),
              source: newSource,
              target: newTarget,
            } satisfies Edge;
          })
          .filter((edge): edge is Edge => edge !== null);

        setNodes((current) => [
          ...current.map((n) => ({ ...n, selected: false })),
          ...pastedNodes,
        ]);
        setEdges((current) => [...current, ...pastedEdges]);
        setSelectedNodeId(pastedNodes[0]?.id ?? null);
        toast.success("Pasted selection from clipboard");
        return;
      }

      e.preventDefault();
      pushHistory();
      setNodes(parsed.nodes as CanvasNode[]);
      setEdges(parsed.edges as Edge[]);
      toast.success("Imported workflow from clipboard");
    };
    const el = containerRef.current ?? window;
    el.addEventListener("paste", handler as EventListener);
    return () => el.removeEventListener("paste", handler as EventListener);
  }, [pushHistory, setEdges, setNodes, setSelectedNodeId]);

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
        onNodeDoubleClick={() => setIsInspectorExpanded(true)} // <-- open inspector
        onInit={(inst) => (rfInstanceRef.current = inst)}
        onPaneClick={() => setSelectedNodeId(null)}
      >
        <Background />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case "agent":
                return "rgba(6, 182, 212, 0.7)";
              case "trigger":
                return "rgba(37, 99, 235, 0.7)";
              case "if":
                return "rgba(139, 92, 246, 0.7)";
              case "http":
                return "rgba(5, 150, 105, 0.7)";
              case "smtp":
                return "rgba(249, 115, 22, 0.7)";
              default:
                return "rgba(107, 114, 128, 0.7)";
            }
          }}
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
          isExpandedDialogOpen={isInspectorExpanded} // pass expanded state
          setIsExpandedDialogOpen={setIsInspectorExpanded}
        />

        {/* Hints */}
        <Panel
          position="bottom-center"
          className="pointer-events-none !bottom-4 !right-auto !left-1/2 !-translate-x-2"
        >
          <div className="rounded-full border border-border/40 bg-background/20 px-3 py-1 text-xs text-muted-foreground/96 backdrop-blur">
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

