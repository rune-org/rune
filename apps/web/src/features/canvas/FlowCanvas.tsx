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
  type Connection,
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
import { SaveTemplateDialog } from "./components/SaveTemplateDialog";
import { ImportTemplateDialog } from "./components/ImportTemplateDialog";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";
import { useAddNode } from "./hooks/useAddNode";
import { useConditionalConnect } from "./hooks/useConditionalConnect";
import { useUpdateNodeData } from "./hooks/useUpdateNodeData";
import { useExecutionSim } from "./hooks/useExecutionSim";
import { useAutoLayout } from "./hooks/useAutoLayout";
import { usePinNode } from "./hooks/usePinNode";
import { sanitizeGraph, stringifyGraph } from "./lib/graphIO";
import { toast } from "@/components/ui/toast";
import { createId } from "./utils/id";
import {
  switchFallbackHandleId,
  switchRuleHandleId,
} from "./utils/switchHandles";

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
  onRun?: (graph: { nodes: CanvasNode[]; edges: Edge[] }) => Promise<void> | void;
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
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isImportTemplateOpen, setIsImportTemplateOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(
    null,
  );
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onConnect = useConditionalConnect(setEdges);
  const addNode = useAddNode(setNodes, containerRef, rfInstanceRef);
  const { run, reset } = useExecutionSim(nodes, edges, setNodes, setEdges);
  const updateNodeData = useUpdateNodeData(setNodes);
  const { togglePin } = usePinNode(setNodes);

  // Validate connections to limit edges based on node type
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const { source, sourceHandle } = connection;

      const sourceNode = nodes.find((node) => node.id === source);
      if (!sourceNode) return false;

      const existingEdges = edges.filter((edge) => edge.source === source);

      // For "if" nodes: allow max 2 edges (true/false)
      if (sourceNode.type === "if") {
        const hasEdgeFromHandle = existingEdges.some(
          (edge) => edge.sourceHandle === sourceHandle
        );
        return !hasEdgeFromHandle;
      }

      if (sourceNode.type === "switch") {
        const rules = Array.isArray(sourceNode.data.rules)
          ? sourceNode.data.rules
          : [];
        const allowedHandles = new Set<string>([
          ...rules.map((_, idx) => switchRuleHandleId(idx)),
          switchFallbackHandleId(),
        ]);
        if (!sourceHandle || !allowedHandles.has(String(sourceHandle))) return false;
        const hasEdgeFromHandle = existingEdges.some(
          (edge) => edge.sourceHandle === sourceHandle,
        );
        return !hasEdgeFromHandle;
      }

      // For all other nodes: allow max 1 edge
      return existingEdges.length === 0;
    },
    [nodes, edges]
  );

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

  const { autoLayout } = useAutoLayout(nodes, edges, setNodes, setEdges, {
    onBeforeLayout: pushHistory,
  });

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

  // Export handlers
  const exportToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(stringifyGraph({ nodes, edges }));
    toast.success("Exported JSON to clipboard");
  }, [nodes, edges]);

  const exportToFile = useCallback(() => {
    const json = stringifyGraph({ nodes, edges });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Exported workflow to file");
  }, [nodes, edges]);

  const exportToTemplate = useCallback(() => {
    if (nodes.length === 0) {
      toast.error("Cannot save empty workflow as template");
      return;
    }
    setIsSaveTemplateOpen(true);
  }, [nodes]);

  // Import handlers
  const importFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.error("Clipboard is empty");
        return;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        toast.error("Clipboard does not contain valid JSON");
        return;
      }
      if (!raw || typeof raw !== "object") {
        toast.error("Invalid workflow data");
        return;
      }
      const candidate = raw as { nodes?: unknown; edges?: unknown };
      if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
        toast.error("Invalid workflow format");
        return;
      }
      const parsed = sanitizeGraph({
        nodes: candidate.nodes as CanvasNode[],
        edges: candidate.edges as Edge[],
      });
      if (parsed.nodes.length === 0) {
        toast.error("No valid nodes found in clipboard data");
        return;
      }
      pushHistory();
      setNodes(parsed.nodes as CanvasNode[]);
      setEdges(parsed.edges as Edge[]);
      toast.success("Imported workflow from clipboard");
    } catch {
      toast.error("Failed to read clipboard");
    }
  }, [pushHistory, setNodes, setEdges]);

  const importFromFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const raw = JSON.parse(text);
          if (!raw || typeof raw !== "object") {
            toast.error("Invalid workflow data");
            return;
          }
          const candidate = raw as { nodes?: unknown; edges?: unknown };
          if (
            !Array.isArray(candidate.nodes) ||
            !Array.isArray(candidate.edges)
          ) {
            toast.error("Invalid workflow format");
            return;
          }
          const parsed = sanitizeGraph({
            nodes: candidate.nodes as CanvasNode[],
            edges: candidate.edges as Edge[],
          });
          if (parsed.nodes.length === 0) {
            toast.error("No valid nodes found in file");
            return;
          }
          pushHistory();
          setNodes(parsed.nodes as CanvasNode[]);
          setEdges(parsed.edges as Edge[]);
          toast.success(`Imported workflow from ${file.name}`);
        } catch {
          toast.error("Failed to parse workflow file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [pushHistory, setNodes, setEdges],
  );

  const importFromTemplate = useCallback(() => {
    setIsImportTemplateOpen(true);
  }, []);

  const handleTemplateSelect = useCallback(
    (workflowData: { nodes: CanvasNode[]; edges: Edge[] }) => {
      const parsed = sanitizeGraph(workflowData);
      pushHistory();
      setNodes(parsed.nodes as CanvasNode[]);
      setEdges(parsed.edges as Edge[]);
      setIsImportTemplateOpen(false);
      toast.success("Imported workflow from template");
    },
    [pushHistory, setNodes, setEdges],
  );

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

  const getNodeColor = (type: string) => {
    const colorVars: Record<string, string> = {
      agent: "--node-agent",
      trigger: "--node-trigger",
      if: "--node-core",
      switch: "--node-core",
      http: "--node-http",
      smtp: "--node-email",
    };
    const varName = colorVars[type];
    return varName
      ? `color-mix(in srgb, var(${varName}) 30%, transparent)`
      : "color-mix(in srgb, var(--muted) 50%, transparent)";
  };

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
        isValidConnection={isValidConnection}
        onSelectionChange={onSelectionChange}
        onNodeDoubleClick={(_evt, node) => {
          setSelectedNodeId(node.id as string);
          setIsInspectorExpanded(true);
        }}
        onInit={(inst) => (rfInstanceRef.current = inst)}
        onPaneClick={() => setSelectedNodeId(null)}
      >
        <Background />

        <MiniMap
          nodeBorderRadius={19}
          position="bottom-left"
          nodeColor={(node) => getNodeColor(node.type as string)}
          nodeStrokeColor="#334155"
          maskColor="rgba(0,0,0,0.2)"
          style={{width: 200, height:117, opacity: 0.85}}
        />

        <Controls 
          style={{ height: 107, marginLeft: "222px", opacity:0.85 }}
        />

        {/* Toolbar */}
        <Panel position="top-left" className="pointer-events-auto z-[60]">
          <div ref={toolbarRef}>
            <Toolbar
              onExecute={() => {
                reset();
                void run();
                if (onRun) void onRun({ nodes, edges });
              }}
              onUndo={undo}
              onSave={async () => {
                await persistGraph();
              }}
              onExportToClipboard={exportToClipboard}
              onExportToFile={exportToFile}
              onExportToTemplate={exportToTemplate}
              onImportFromClipboard={importFromClipboard}
              onImportFromFile={importFromFile}
              onImportFromTemplate={importFromTemplate}
              onFitView={() => rfInstanceRef.current?.fitView()}
              onAutoLayout={autoLayout}
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
          isExpandedDialogOpen={isInspectorExpanded}
          setIsExpandedDialogOpen={setIsInspectorExpanded}
          onTogglePin={togglePin}
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

      {/* Hidden file input for importing JSON files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Save as Template dialog */}
      <SaveTemplateDialog
        open={isSaveTemplateOpen}
        onOpenChange={setIsSaveTemplateOpen}
        workflowData={{ nodes, edges }}
      />

      {/* Import from Templates dialog */}
      <ImportTemplateDialog
        open={isImportTemplateOpen}
        onOpenChange={setIsImportTemplateOpen}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}
