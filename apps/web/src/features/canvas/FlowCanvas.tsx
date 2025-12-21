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
import type { CanvasEdge, CanvasNode } from "./types";
import { Toolbar } from "./components/Toolbar";
import { RightPanelStack } from "./components/RightPanelStack";
import { Library } from "./components/Library";
import { SaveTemplateDialog } from "./components/SaveTemplateDialog";
import { ImportTemplateDialog } from "./components/ImportTemplateDialog";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";
import { useAddNode } from "./hooks/useAddNode";
import { useConditionalConnect } from "./hooks/useConditionalConnect";
import { useCanvasHistory } from "./hooks/useCanvasHistory";
import { useUpdateNodeData } from "./hooks/useUpdateNodeData";
import { useExecutionSim } from "./hooks/useExecutionSim";
import { useAutoLayout } from "./hooks/useAutoLayout";
import { usePinNode } from "./hooks/usePinNode";
import { sanitizeGraph, stringifyGraph } from "./lib/graphIO";
import { applyAutoLayout } from "./lib/autoLayout";
import { workflowDataToCanvas } from "@/lib/workflow-dsl";
import { toast } from "@/components/ui/toast";
import { createId } from "./utils/id";
import {
  switchFallbackHandleId,
  switchRuleHandleId,
} from "./utils/switchHandles";
import { SmithChatDrawer, type SmithChatMessage } from "@/features/smith/SmithChatDrawer";
import { graphToWorkflowData } from "@/lib/workflows";
import { smith } from "@/lib/api";
import Image from "next/image";

const CLIPBOARD_SELECTION_TYPE = "rune.canvas.selection";
const PASTE_OFFSET = 32;

export default function FlowCanvas({
  externalNodes,
  externalEdges,
  onPersist,
  onRun,
  saveDisabled = false,
  workflowId = null,
}: {
  externalNodes?: CanvasNode[];
  externalEdges?: Edge[];
  onPersist?: (graph: {
    nodes: CanvasNode[];
    edges: Edge[];
  }) => Promise<void> | void;
  onRun?: (graph: { nodes: CanvasNode[]; edges: Edge[] }) => Promise<void> | void;
  saveDisabled?: boolean;
  workflowId?: number | null;
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
  const [isSmithOpen, setIsSmithOpen] = useState(false);
  const [smithMessages, setSmithMessages] = useState<SmithChatMessage[]>([]);
  const [smithInput, setSmithInput] = useState("");
  const [smithSending, setSmithSending] = useState(false);
  const [smithShowTrace, setSmithShowTrace] = useState(false);
  const [pendingSmithPrompt, setPendingSmithPrompt] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(
    null,
  );
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onConnect = useConditionalConnect(setEdges);
  const addNode = useAddNode(setNodes, containerRef, rfInstanceRef);
  const { run, reset } = useExecutionSim(nodes, edges, setNodes, setEdges);
  const updateNodeData = useUpdateNodeData(setNodes);
  const { togglePin } = usePinNode(setNodes);
  const { pushHistory, undo, redo, canUndo, canRedo } = useCanvasHistory(nodes, edges);

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const { source, target, sourceHandle } = connection;

      if (source === target) return false;

      const sourceNode = nodes.find((node) => node.id === source);
      const targetNode = nodes.find((node) => node.id === target);
      if (!sourceNode || !targetNode) return false;

      const existingSourceEdges = edges.filter((edge) => edge.source === source);

      // For "if" nodes: allow max 1 edge per output handle (true/false)
      if (sourceNode.type === "if") {
        const hasEdgeFromHandle = existingSourceEdges.some(
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
        const hasEdgeFromHandle = existingSourceEdges.some(
          (edge) => edge.sourceHandle === sourceHandle,
        );
        return !hasEdgeFromHandle;
      }

      // For all other nodes: allow max 1 outgoing edge
      return existingSourceEdges.length === 0;
    },
    [nodes, edges]
  );

  const persistGraph = useCallback(() => {
    if (!onPersist) return;
    return onPersist({ nodes, edges });
  }, [onPersist, nodes, edges]);

  const { autoLayout } = useAutoLayout(nodes, edges, setNodes, setEdges, {
    onBeforeLayout: pushHistory,
  });

  const applySmithWorkflow = useCallback(
    (workflow: Record<string, unknown>) => {
      const candidateNodes = Array.isArray(
        (workflow as { nodes?: unknown }).nodes,
      )
        ? ((workflow as { nodes: Parameters<typeof workflowDataToCanvas>[0]["nodes"] })
            .nodes ?? [])
        : [];
      const candidateEdges = Array.isArray(
        (workflow as { edges?: unknown }).edges,
      )
        ? ((workflow as { edges: Parameters<typeof workflowDataToCanvas>[0]["edges"] })
            .edges ?? [])
        : [];

      if (candidateNodes.length === 0) {
        throw new Error("Smith returned an empty workflow");
      }

      const { nodes: canvasNodes, edges: canvasEdges } = workflowDataToCanvas({
        nodes: candidateNodes,
        edges: candidateEdges,
      });
      const sanitized = sanitizeGraph({
        nodes: canvasNodes,
        edges: canvasEdges,
      });
      const layouted = applyAutoLayout({
        nodes: sanitized.nodes as CanvasNode[],
        edges: sanitized.edges as Edge[],
        respectPinned: true,
      });

      pushHistory();
      setNodes(() => layouted.nodes as CanvasNode[]);
      setEdges(() => layouted.edges as Edge[]);
      toast.success("Smith updated the canvas");
    },
    [pushHistory, setEdges, setNodes],
  );

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

  const handleUndo = useCallback(() => {
    const state = undo();
    if (state) {
      setNodes(state.nodes);
      setEdges(state.edges);
    }
  }, [undo, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const state = redo();
    if (state) {
      setNodes(state.nodes);
      setEdges(state.edges);
    }
  }, [redo, setNodes, setEdges]);

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
  const importFromClipboard = useCallback(() => {
    toast("Press Ctrl+V (or Cmd+V) to paste workflow from clipboard");
  }, []);

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

  const handleSmithSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || smithSending) return;

      const userMessage: SmithChatMessage = { role: "user", content: trimmed };
      const history = [...smithMessages, userMessage];
      setSmithMessages(history);
      setSmithInput("");
      setSmithSending(true);

      let workflowContext: Record<string, unknown> | null = null;
      try {
        workflowContext = graphToWorkflowData({
          nodes: nodes as CanvasNode[],
          edges: edges as CanvasEdge[],
        });
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Unable to include current workflow for Smith.",
        );
        setSmithSending(false);
        return;
      }

      try {
        const response = await smith.generateWorkflow({
          prompt: trimmed,
          history: history.map((m) => ({ role: m.role, content: m.content })),
          workflow: workflowContext,
          include_trace: smithShowTrace,
        });

        const smithData = response.data?.data as
          | { response?: string; workflow?: Record<string, unknown>; trace?: string[] }
          | undefined;

        if (!smithData?.workflow) {
          throw new Error(
            smithData?.response || "Smith response did not include a workflow.",
          );
        }

        setSmithMessages((prev) => [
          ...prev,
          {
            role: "smith",
            content: smithData.response || "Updated the workflow.",
            trace: smithShowTrace && smithData.trace ? smithData.trace : undefined,
          } as SmithChatMessage,
        ]);

        applySmithWorkflow(smithData.workflow);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Smith could not update the workflow",
        );
      } finally {
        setSmithSending(false);
      }
    },
    [
      applySmithWorkflow,
      edges,
      nodes,
      smithMessages,
      smithSending,
      smithShowTrace,
    ],
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
    onUndo: handleUndo,
    onRedo: handleRedo,
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

  // Restore per-workflow Smith chat history from localStorage
  useEffect(() => {
    const key = `smith-history-${workflowId ?? "scratch"}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          messages?: SmithChatMessage[];
        };
        setSmithMessages(parsed.messages ?? []);
      } else {
        setSmithMessages([]);
      }
    } catch {
      setSmithMessages([]);
    }
  }, [workflowId]);

  // Persist per-workflow Smith chat history
  useEffect(() => {
    const key = `smith-history-${workflowId ?? "scratch"}`;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          messages: smithMessages,
        }),
      );
    } catch {
      // ignore
    }
  }, [smithMessages, workflowId]);

  useEffect(() => {
    if (isSmithOpen && smithMessages.length === 0) {
      setSmithMessages([
        {
          role: "smith",
          content:
            "Hi, I'm Smith. Describe what to build or edit and I'll wire the workflow for you.",
        },
      ]);
    }
  }, [isSmithOpen, smithMessages.length]);

  // Auto-run Smith prompt seeded from quickstart/local storage
  useEffect(() => {
    if (!workflowId) return;
    try {
      const savedPrompt = localStorage.getItem(`smith-prompt-${workflowId}`);
      const savedTracePref = localStorage.getItem(
        `smith-show-trace-${workflowId}`,
      );
      if (savedPrompt) {
        setPendingSmithPrompt(savedPrompt);
        setSmithShowTrace(savedTracePref === "true");
        localStorage.removeItem(`smith-prompt-${workflowId}`);
        localStorage.removeItem(`smith-show-trace-${workflowId}`);
      }
    } catch {
      // ignore
    }
  }, [workflowId]);

  useEffect(() => {
    if (pendingSmithPrompt && !smithSending) {
      setIsSmithOpen(true);
      void handleSmithSend(pendingSmithPrompt);
      setPendingSmithPrompt(null);
    }
  }, [pendingSmithPrompt, smithSending, handleSmithSend]);

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
        nodes?: unknown[];
        edges?: unknown[];
      };

      if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
        return;
      }

      const clipboardType = candidate.__runeClipboardType ?? null;

      // Detect worker DSL format
      const isWorkerDSL = candidate.edges.some(
        (e) => e && typeof e === "object" && "src" in e && "dst" in e
      );

      // Convert worker DSL to canvas
      const graphData = isWorkerDSL
        ? workflowDataToCanvas({
            nodes: candidate.nodes as Parameters<typeof workflowDataToCanvas>[0]["nodes"],
            edges: candidate.edges as Parameters<typeof workflowDataToCanvas>[0]["edges"],
          })
        : { nodes: candidate.nodes as CanvasNode[], edges: candidate.edges as Edge[] };

      const parsed = sanitizeGraph(graphData);

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
      wait: "--node-core",
      edit: "--node-core",
      split: "--node-core",
      aggregator: "--node-core",
      merge: "--node-core",
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
          <div ref={toolbarRef} className="flex items-center gap-2">
            <Toolbar
              onExecute={() => {
                reset();
                void run();
                if (onRun) void onRun({ nodes, edges });
              }}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
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
            <button
              type="button"
              onClick={() => setIsSmithOpen(true)}
              className="group relative flex h-13 w-13 items-center justify-center overflow-hidden rounded-full p-[1px] shadow-lg transition-all hover:shadow-primary/25 hover:scale-105 active:scale-95"
              title="Ask Smith"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 opacity-0 blur-[2px] transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full border border-border/60 bg-background/20 backdrop-blur-md transition-colors group-hover:bg-background/80">
                <Image
                  src="/icons/smith_logo_compact_white.svg"
                  alt="Smith"
                  width={30}
                  height={30}
                  
                  priority
                />
              </div>
            </button>
          </div>
        </Panel>

        {/* Right Sidebar (Inspector + Scryb) */}
        <RightPanelStack
          selectedNode={selectedNode}
          updateSelectedNodeLabel={updateSelectedNodeLabel}
          updateData={updateNodeData}
          onDelete={selectedNode ? deleteSelectedElements : undefined}
          isExpandedDialogOpen={isInspectorExpanded}
          setIsExpandedDialogOpen={setIsInspectorExpanded}
          onTogglePin={togglePin}
          workflowId={workflowId}
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

      <SmithChatDrawer
        open={isSmithOpen}
        onOpenChange={setIsSmithOpen}
        messages={smithMessages}
        input={smithInput}
        onInputChange={setSmithInput}
        onSend={handleSmithSend}
        isSending={smithSending}
        showTrace={smithShowTrace}
        onToggleTrace={(next) => setSmithShowTrace(next)}
      />
    </div>
  );
}
