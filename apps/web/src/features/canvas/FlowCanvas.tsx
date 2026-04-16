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
import {
  scanVariableReferences,
  replaceVariableReferences,
  type ScanResult,
} from "./lib/variableRefUpdate";
import { RenameRefDialog, type RenameChoice } from "./components/RenameRefDialog";
import { Toolbar } from "./components/Toolbar";
import { RightPanelStack } from "./components/RightPanelStack";
import { Library } from "./components/Library";
import { SaveTemplateDialog } from "./components/SaveTemplateDialog";
import { ImportTemplateDialog } from "./components/ImportTemplateDialog";
import { SaveVersionDialog } from "./components/SaveVersionDialog";
import { VersionConflictDialog } from "./components/VersionConflictDialog";
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
import { useExecutionFromUrl } from "./hooks/useExecutionFromUrl";
import { ExecutionProvider, useExecution } from "./context/ExecutionContext";
import { GraphProvider } from "./context/GraphContext";
import { SmithChatDrawer } from "@/features/smith/SmithChatDrawer";

type FlowCanvasProps = {
  externalNodes?: CanvasNode[];
  externalEdges?: Edge[];
  onPersist?: (graph: {
    nodes: CanvasNode[];
    edges: Edge[];
  }) => Promise<number | null | void> | number | null | void;
  onSaveWithMessage?: (
    graph: {
      nodes: CanvasNode[];
      edges: Edge[];
    },
    message: string,
  ) => Promise<void> | void;
  saveDisabled?: boolean;
  workflowId?: number | null;
  onPublish?: () => void;
  hasUnpublishedChanges?: boolean;
  publishDisabled?: boolean;
  onRestore?: (versionId: number) => void;
  onRunVersion?: (versionId: number) => void;
  conflictData?: {
    serverVersion: number;
    serverVersionId: number;
    localGraph: { nodes: CanvasNode[]; edges: Edge[] };
  } | null;
  onConflictLoadServer?: () => void;
  onConflictForceSave?: () => void;
  onConflictCancel?: () => void;
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
  onSaveWithMessage,
  saveDisabled = false,
  workflowId = null,
  onPublish,
  hasUnpublishedChanges = false,
  publishDisabled = false,
  onRestore,
  onRunVersion,
  conflictData,
  onConflictLoadServer,
  onConflictForceSave,
  onConflictCancel,
}: FlowCanvasProps) {
  const [nodes, setNodes] = useNodesState<CanvasNode>(externalNodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(externalEdges ?? []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{
    oldName: string;
    newName: string;
    nodeId: string;
    nodeType: NodeKind;
    scanResult: ScanResult;
  } | null>(null);

  const [versionSnapshot, setVersionSnapshot] = useState<{
    nodes: CanvasNode[];
    edges: Edge[];
    versionNumber: number;
  } | null>(null);

  const [saveVersionDialogOpen, setSaveVersionDialogOpen] = useState(false);

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
    containerRef.current?.setAttribute("data-canvas-dragging", dragging ? "true" : "false");
  }, []);

  const { onNodesChange, onNodeDragStart, onNodeDragStop } = useRafNodeDrag(setNodes, {
    onDragStateChange: handleDragStateChange,
  });

  const onConnect = useConditionalConnect(setEdges);
  const addNode = useAddNode(setNodes, containerRef, rfInstanceRef);
  const updateNodeData = useUpdateNodeData(setNodes);
  const { togglePin } = usePinNode(setNodes);
  const { pushHistory, undo, redo, canUndo, canRedo } = useCanvasHistory(nodes, edges);

  const {
    executionState,
    wsStatus,
    wsReconnectAttempts,
    isStarting: isStartingExecution,
    startExecution,
    stopExecution,
    reset: resetExecution,
  } = useWorkflowExecution({ workflowId });

  useExecutionEdgeSync(executionState, setEdges);

  const { setExecutionParam } = useExecutionFromUrl(workflowId);

  // Historical snapshot detection
  const { state: ctxExecutionState } = useExecution();
  const isViewingExecutionSnapshot =
    ctxExecutionState.isHistorical === true && !!ctxExecutionState.graphSnapshot;

  const isViewingSnapshot = isViewingExecutionSnapshot || !!versionSnapshot;

  // Save/restore the live canvas when entering/leaving snapshot mode.
  const savedLiveNodesRef = useRef<CanvasNode[] | null>(null);
  const savedLiveEdgesRef = useRef<Edge[] | null>(null);

  // Execution snapshot save/restore
  useEffect(() => {
    if (isViewingExecutionSnapshot && ctxExecutionState.graphSnapshot) {
      if (savedLiveNodesRef.current === null) {
        savedLiveNodesRef.current = nodesRef.current;
        savedLiveEdgesRef.current = edgesRef.current;
      }
      setNodes(ctxExecutionState.graphSnapshot.nodes);
      setEdges(ctxExecutionState.graphSnapshot.edges);
    } else if (!versionSnapshot && savedLiveNodesRef.current !== null) {
      setNodes(savedLiveNodesRef.current);
      setEdges(savedLiveEdgesRef.current ?? []);
      savedLiveNodesRef.current = null;
      savedLiveEdgesRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewingExecutionSnapshot, ctxExecutionState.graphSnapshot]);

  useEffect(() => {
    if (versionSnapshot) {
      if (savedLiveNodesRef.current === null) {
        savedLiveNodesRef.current = nodesRef.current;
        savedLiveEdgesRef.current = edgesRef.current;
      }
      setNodes(versionSnapshot.nodes);
      setEdges(versionSnapshot.edges);
    } else if (!isViewingExecutionSnapshot && savedLiveNodesRef.current !== null) {
      setNodes(savedLiveNodesRef.current);
      setEdges(savedLiveEdgesRef.current ?? []);
      savedLiveNodesRef.current = null;
      savedLiveEdgesRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionSnapshot]);

  // NOTE: Keep this effect after the snapshot save/restore effects above.
  // While viewing history we intentionally ignore external graph prop updates so
  // that "Return to Live" restores the pre-snapshot in-memory draft.
  useEffect(() => {
    if (isViewingSnapshot) return;
    setNodes(externalNodes ?? []);
    setEdges(externalEdges ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalNodes, externalEdges]);

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
  } = useSmith({
    workflowId,
    readOnly: isViewingSnapshot,
    pushHistory,
    setNodes,
    setEdges,
    rfInstanceRef,
  });

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
    readOnly: isViewingSnapshot,
    selectedNodeId,
    pushHistory,
    setNodes,
    setEdges,
    setSelectedNodeId,
  });

  const persistGraph = useCallback(() => {
    if (!onPersist) return;
    return onPersist({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    });
  }, [onPersist]);

  const handleSaveVersionWithMessage = useCallback(
    (message: string) => {
      if (!onSaveWithMessage) return;
      setSaveVersionDialogOpen(false);
      return onSaveWithMessage({ nodes: nodesRef.current, edges: edgesRef.current }, message);
    },
    [onSaveWithMessage],
  );

  const handleViewVersion = useCallback(
    (snapshot: { nodes: CanvasNode[]; edges: Edge[]; versionNumber: number } | null) => {
      setVersionSnapshot(snapshot);
    },
    [],
  );

  const handleRestore = useCallback(
    (versionId: number) => {
      savedLiveNodesRef.current = null;
      savedLiveEdgesRef.current = null;

      setVersionSnapshot(null);
      onRestore?.(versionId);
    },
    [onRestore],
  );

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
    const selectedNodeIds = new Set(nodesRef.current.filter((n) => n.selected).map((n) => n.id));
    setNodes((ns) => ns.filter((n) => !selectedNodeIds.has(n.id)));
    setEdges((es) =>
      es.filter((e) => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)),
    );
  }, [pushHistory, setNodes, setEdges]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const updateSelectedNodeLabel = useCallback(
    (newLabel: string) => {
      if (!selectedNode) return;
      const oldName = selectedNode.data.label;

      const needsScan = oldName && oldName !== newLabel;
      if (!needsScan) {
        updateNodeData(selectedNode.id, selectedNode.type, () => ({ label: newLabel }));
        return;
      }

      const otherNodes = nodes.filter((n) => n.id !== selectedNode.id);
      const result = scanVariableReferences(otherNodes, oldName);

      if (result.totalRefs === 0) {
        updateNodeData(selectedNode.id, selectedNode.type, () => ({ label: newLabel }));
        return;
      }

      setRenameDialog({
        oldName,
        newName: newLabel,
        nodeId: selectedNode.id,
        nodeType: selectedNode.type,
        scanResult: result,
      });
    },
    [selectedNode, updateNodeData, nodes],
  );

  const handleRenameChoice = useCallback(
    (choice: RenameChoice) => {
      if (!renameDialog) return;
      const { oldName, newName, nodeId, nodeType } = renameDialog;
      setRenameDialog(null);

      if (choice === "cancel") return;

      pushHistory();

      if (choice === "skip") {
        updateNodeData(nodeId, nodeType, () => ({ label: newName }));
        return;
      }

      setNodes((currentNodes) => {
        const existingLabels = new Set(
          currentNodes
            .filter((n) => n.id !== nodeId)
            .map((n) => n.data.label)
            .filter(Boolean),
        );

        let uniqueLabel = newName;
        let counter = 2;
        while (existingLabels.has(uniqueLabel)) {
          uniqueLabel = `${newName}_${counter}`;
          counter++;
        }

        const updated = replaceVariableReferences(currentNodes, oldName, uniqueLabel);

        return updated.map((n) =>
          n.id === nodeId ? ({ ...n, data: { ...n.data, label: uniqueLabel } } as CanvasNode) : n,
        );
      });
    },
    [renameDialog, pushHistory, updateNodeData, setNodes],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodeId(params.nodes[0]?.id ?? null);
  }, []);

  const onNodeDoubleClick = useCallback((_evt: React.MouseEvent, node: CanvasNode) => {
    setSelectedNodeId(node.id);
    setIsInspectorExpanded(true);
  }, []);

  const onInit = useCallback((inst: ReactFlowInstance<CanvasNode, Edge>) => {
    rfInstanceRef.current = inst;
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
    if (isViewingSnapshot) {
      toast.error("Execution is disabled while viewing history");
      return;
    }

    if (!workflowId) {
      toast.error("Save the workflow before execution");
      return;
    }

    resetExecution();
    let versionIdToRun: number | undefined;
    if (onPersist) {
      try {
        const nodes = nodesRef.current;
        const edges = edgesRef.current;
        const persistedVersionId = await onPersist({ nodes, edges });
        if (typeof persistedVersionId === "number") {
          versionIdToRun = persistedVersionId;
        } else {
          return;
        }
      } catch {
        toast.error("Failed to save workflow before execution");
        return;
      }
    }
    void startExecution(versionIdToRun);
  }, [isViewingSnapshot, onPersist, resetExecution, startExecution, workflowId]);

  useCanvasShortcuts({
    nodes,
    edges,
    readOnly: isViewingSnapshot,
    selectedNodeId,
    setNodes,
    setEdges,
    onDelete: deleteSelectedElements,
    onSave: () => {
      void persistGraph();
    },
    onSaveWithMessage: onSaveWithMessage ? () => setSaveVersionDialogOpen(true) : undefined,
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

  const bottomBarMessage = versionSnapshot
    ? `Viewing version v${versionSnapshot.versionNumber} (read-only)`
    : isViewingExecutionSnapshot
      ? "Viewing historical execution snapshot (read-only)"
      : "Drag to move \u2022 Connect via handles \u2022 Paste JSON to import";

  return (
    <GraphProvider nodes={nodes} edges={edges}>
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
          readOnly={isViewingSnapshot}
          wsStatus={wsStatus}
          wsReconnectAttempts={wsReconnectAttempts}
          onDismissRunning={stopExecution}
        />

        <div className="pointer-events-none absolute left-4 top-4 z-35">
          <div ref={toolbarRef} className="pointer-events-auto flex items-center gap-2">
            <Toolbar
              onExecute={onExecute}
              executeDisabled={isViewingSnapshot}
              readOnly={isViewingSnapshot}
              onStop={stopExecution}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={!isViewingSnapshot && canUndo}
              canRedo={!isViewingSnapshot && canRedo}
              onSave={persistGraph}
              onExportToClipboard={exportToClipboard}
              onExportToFile={exportToFile}
              onExportToTemplate={exportToTemplate}
              onImportFromClipboard={importFromClipboard}
              onImportFromFile={importFromFile}
              onImportFromTemplate={importFromTemplate}
              onAutoLayout={autoLayout}
              saveDisabled={saveDisabled || isViewingSnapshot}
              executionStatus={executionState.status}
              wsStatus={wsStatus}
              isStartingExecution={isStartingExecution}
              workflowId={workflowId}
              onPublish={onPublish}
              hasUnpublishedChanges={hasUnpublishedChanges}
              publishDisabled={publishDisabled}
              onRestore={handleRestore}
              onRunVersion={onRunVersion}
              onViewVersion={handleViewVersion}
              viewingVersionNumber={versionSnapshot?.versionNumber}
              onExecutionUrlChange={setExecutionParam}
            />
            <SmithButton
              onClick={openSmith}
              isSending={smithSending}
              justFinished={smithJustFinished}
              disabled={isViewingSnapshot}
            />
          </div>
        </div>

        {/* Right Sidebar (Inspector + Scryb) */}
        <RightPanelStack
          selectedNode={selectedNode}
          updateSelectedNodeLabel={updateSelectedNodeLabel}
          updateData={updateNodeData}
          onDelete={selectedNode && !isViewingSnapshot ? deleteSelectedElements : undefined}
          isExpandedDialogOpen={isInspectorExpanded}
          setIsExpandedDialogOpen={setIsInspectorExpanded}
          onTogglePin={isViewingSnapshot ? undefined : togglePin}
          workflowId={workflowId}
          readOnly={isViewingSnapshot}
        />

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
          <div className="rounded-full border border-border/40 bg-background/20 px-3 py-1 text-xs text-muted-foreground/96 backdrop-blur">
            {bottomBarMessage}
          </div>
        </div>

        {!isViewingSnapshot && (
          <Library
            containerRef={containerRef}
            toolbarRef={toolbarRef}
            onAdd={onLibraryAdd}
            shortcutsByKind={shortcutsByKind}
            onAssignShortcut={assignShortcut}
            onResetShortcuts={resetShortcuts}
          />
        )}

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

        {/* Save Version with Message dialog */}
        <SaveVersionDialog
          open={saveVersionDialogOpen}
          onOpenChange={setSaveVersionDialogOpen}
          onSave={handleSaveVersionWithMessage}
          isSaving={saveDisabled}
        />

        {/* Version Conflict dialog */}
        {conflictData && onConflictLoadServer && onConflictForceSave && onConflictCancel && (
          <VersionConflictDialog
            open={!!conflictData}
            serverVersion={conflictData.serverVersion}
            serverVersionId={conflictData.serverVersionId}
            onLoadServer={onConflictLoadServer}
            onForceSave={onConflictForceSave}
            onCancel={onConflictCancel}
          />
        )}

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

        {renameDialog && (
          <RenameRefDialog
            open={true}
            oldName={renameDialog.oldName}
            newName={renameDialog.newName}
            scanResult={renameDialog.scanResult}
            onChoice={handleRenameChoice}
          />
        )}
      </div>
    </GraphProvider>
  );
}
