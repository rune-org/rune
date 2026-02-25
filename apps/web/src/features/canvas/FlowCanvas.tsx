"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useEdgesState,
  useNodesState,
  type Edge,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./styles/reactflow.css";

import { toast } from "@/components/ui/toast";
import type { CanvasNode, NodeKind } from "./types";
import { Toolbar } from "./components/Toolbar";
import { RightPanelStack } from "./components/RightPanelStack";
import { Library } from "./components/Library";
import { SaveTemplateDialog } from "./components/SaveTemplateDialog";
import { ImportTemplateDialog } from "./components/ImportTemplateDialog";
import { SmithButton } from "./components/SmithButton";
import { FlowViewport } from "./components/FlowViewport";
import { useCanvasShortcuts } from "./hooks/useCanvasShortcuts";
import { useNodeShortcuts } from "./hooks/useNodeShortcuts";
import { useAddNode } from "./hooks/useAddNode";
import { useConditionalConnect } from "./hooks/useConditionalConnect";
import { useCanvasHistory } from "./hooks/useCanvasHistory";
import { useUpdateNodeData } from "./hooks/useUpdateNodeData";
import { useAutoLayout } from "./hooks/useAutoLayout";
import { usePinNode } from "./hooks/usePinNode";
import { useWorkflowExecution } from "./hooks/useWorkflowExecution";
import { useExecutionEdgeSync } from "./hooks/useExecutionEdgeSync";
import { useConnectionValidation } from "./hooks/useConnectionValidation";
import { useGraphClipboard } from "./hooks/useGraphClipboard";
import { useRafNodeDrag } from "./hooks/useRafNodeDrag";
import { useSmith } from "./hooks/useSmith";
import { ExecutionProvider } from "./context/ExecutionContext";
import { SmithChatDrawer } from "@/features/smith/SmithChatDrawer";

type FlowCanvasProps = {
  externalNodes?: CanvasNode[];
  externalEdges?: Edge[];
  onPersist?: (graph: {
    nodes: CanvasNode[];
    edges: Edge[];
  }) => Promise<void> | void;
  saveDisabled?: boolean;
  workflowId?: number | null;
};

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ExecutionProvider>
      <FlowCanvasInner {...props} />
    </ExecutionProvider>
  );
}

function FlowCanvasInner({
  externalNodes,
  externalEdges,
  onPersist,
  saveDisabled = false,
  workflowId = null,
}: FlowCanvasProps) {
  const [nodes, setNodes] = useNodesState<CanvasNode>(externalNodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    externalEdges ?? [],
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  const {
    shortcutsRef,
    shortcutsByKind,
    assignShortcut,
    resetToDefaults: resetShortcuts,
  } = useNodeShortcuts();

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    el.addEventListener("mousemove", handler);
    return () => el.removeEventListener("mousemove", handler);
  }, []);

  const handleDragStateChange = useCallback((dragging: boolean) => {
    containerRef.current?.setAttribute(
      "data-canvas-dragging",
      dragging ? "true" : "false",
    );
  }, []);

  const { onNodesChange, onNodeDragStart, onNodeDragStop } = useRafNodeDrag(
    setNodes,
    { onDragStateChange: handleDragStateChange },
  );

  const onConnect = useConditionalConnect(setEdges);
  const addNode = useAddNode(setNodes, containerRef, rfInstanceRef);
  const updateNodeData = useUpdateNodeData(setNodes);
  const { togglePin } = usePinNode(setNodes);
  const { pushHistory, undo, redo, canUndo, canRedo } = useCanvasHistory(nodes, edges);

  const {
    executionState,
    isStarting: isStartingExecution,
    startExecution,
    stopExecution,
    reset: resetExecution,
  } = useWorkflowExecution({ workflowId });

  useExecutionEdgeSync(executionState, setEdges);

  const { autoLayout } = useAutoLayout(nodes, edges, setNodes, setEdges, {
    onBeforeLayout: pushHistory,
  });

  const isValidConnection = useConnectionValidation({ nodes, edges });

  const {
    isSmithOpen,
    setIsSmithOpen,
    openSmith,
    smithMessages,
    smithInput,
    setSmithInput,
    smithSending,
    smithShowTrace,
    setSmithShowTrace,
    smithJustFinished,
    handleSmithSend,
  } = useSmith({ workflowId, pushHistory, setNodes, setEdges, rfInstanceRef });

  const {
    copySelection,
    exportToClipboard,
    exportToFile,
    exportToTemplate,
    importFromClipboard,
    importFromFile,
    handleFileImport,
    importFromTemplate,
    handleTemplateSelect,
    isSaveTemplateOpen,
    setIsSaveTemplateOpen,
    isImportTemplateOpen,
    setIsImportTemplateOpen,
    fileInputRef,
  } = useGraphClipboard({
    nodes,
    edges,
    selectedNodeId,
    pushHistory,
    setNodes,
    setEdges,
    setSelectedNodeId,
    containerRef,
  });

  const persistGraph = useCallback(() => {
    if (!onPersist) return;
    return onPersist({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    });
  }, [onPersist]);

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

  const deleteSelectedElements = useCallback(() => {
    pushHistory();
    const selectedNodeIds = new Set(
      nodesRef.current.filter((n) => n.selected).map((n) => n.id),
    );
    setNodes((ns) => ns.filter((n) => !selectedNodeIds.has(n.id)));
    setEdges((es) =>
      es.filter(
        (e) => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target),
      ),
    );
  }, [pushHistory, setNodes, setEdges]);

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

  const onNodeDoubleClick = useCallback(
    (_evt: React.MouseEvent, node: CanvasNode) => {
      setSelectedNodeId(node.id);
      setIsInspectorExpanded(true);
    },
    [],
  );

  const onInit = useCallback(
    (inst: ReactFlowInstance<CanvasNode, Edge>) => {
      rfInstanceRef.current = inst;
    },
    [],
  );

  const handleFitView = useCallback(() => {
    rfInstanceRef.current?.fitView();
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const onLibraryAdd = useCallback(
    (t: NodeKind, x?: number, y?: number) => {
      pushHistory();
      addNode(t, x, y);
    },
    [pushHistory, addNode],
  );

  const onExecute = useCallback(async () => {
    resetExecution();
    if (onPersist) {
      try {
        const nodes = nodesRef.current;
        const edges = edgesRef.current;
        await onPersist({ nodes, edges });
      } catch {
        toast.error("Failed to save workflow before execution");
        return;
      }
    }
    void startExecution();
  }, [resetExecution, onPersist, startExecution]);

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
    shortcutsRef,
    onNodeShortcut: (kind) => {
      pushHistory();
      const pos = mousePosRef.current;
      if (pos) {
        addNode(kind, pos.x, pos.y);
      } else {
        addNode(kind);
      }
    },
  });

  useEffect(() => {
    setNodes(externalNodes ?? []);
    setEdges(externalEdges ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalNodes, externalEdges]);

  return (
    <div
      ref={containerRef}
      data-canvas-dragging="false"
      className="relative h-full w-full overflow-hidden"
    >
      <FlowViewport
        nodes={nodes}
        edges={edges}
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
      />

      <div className="pointer-events-none absolute left-4 top-4 z-35">
        <div ref={toolbarRef} className="pointer-events-auto flex items-center gap-2">
          <Toolbar
            onExecute={onExecute}
            onStop={stopExecution}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            onSave={persistGraph}
            onExportToClipboard={exportToClipboard}
            onExportToFile={exportToFile}
            onExportToTemplate={exportToTemplate}
            onImportFromClipboard={importFromClipboard}
            onImportFromFile={importFromFile}
            onImportFromTemplate={importFromTemplate}
            onFitView={handleFitView}
            onAutoLayout={autoLayout}
            saveDisabled={saveDisabled}
            executionStatus={executionState.status}
            isStartingExecution={isStartingExecution}
            workflowId={workflowId}
          />
          <SmithButton
            onClick={openSmith}
            isSending={smithSending}
            justFinished={smithJustFinished}
          />
        </div>
      </div>

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

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
        <div className="rounded-full border border-border/40 bg-background/20 px-3 py-1 text-xs text-muted-foreground/96 backdrop-blur">
          Drag to move • Connect via handles • Paste JSON to import
        </div>
      </div>

      <Library
        containerRef={containerRef}
        toolbarRef={toolbarRef}
        onAdd={onLibraryAdd}
        shortcutsByKind={shortcutsByKind}
        onAssignShortcut={assignShortcut}
        onResetShortcuts={resetShortcuts}
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
        onToggleTrace={setSmithShowTrace}
      />
    </div>
  );
}
