"use client";

import { useState, useMemo } from "react";
import { Panel } from "@xyflow/react";
import {
  Maximize2,
  Trash2,
  ArrowRightLeft,
  Settings,
  Pin,
  PinOff,
} from "lucide-react";
import type { CanvasNode } from "../types";
import { NODE_SCHEMA } from "../types";
import { useUpdateNodeData } from "../hooks/useUpdateNodeData";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { IfInspector } from "./inspectors/IfInspector";
import { HttpInspector } from "./inspectors/HttpInspector";
import { SmtpInspector } from "./inspectors/SmtpInspector";
import { SwitchInspector } from "./inspectors/SwitchInspector";

type InspectorProps = {
  selectedNode: CanvasNode | null;
  updateSelectedNodeLabel: (value: string) => void;
  updateData: ReturnType<typeof useUpdateNodeData>;
  onDelete?: () => void;
  isExpandedDialogOpen?: boolean;
  setIsExpandedDialogOpen?: (open: boolean) => void;
  onTogglePin?: (nodeId: string) => void;
};

function renderInspectorForm(
  node: CanvasNode,
  updateData: ReturnType<typeof useUpdateNodeData>,
  isExpanded: boolean,
) {
  switch (node.type) {
    case "http":
      return <HttpInspector node={node} updateData={updateData} isExpanded={isExpanded} />;
    case "if":
      return <IfInspector node={node} updateData={updateData} isExpanded={isExpanded} />;
    case "switch":
      return (
        <SwitchInspector node={node} updateData={updateData} isExpanded={isExpanded} />
      );
    case "smtp":
      return <SmtpInspector node={node} updateData={updateData} isExpanded={isExpanded} />;
    default:
      return null;
  }
}

function getNodeInputsOutputs(node: CanvasNode): {
  inputs: readonly string[];
  outputs: readonly string[];
} {
  if (node.type === "switch") {
    const rules = Array.isArray(node.data.rules) ? node.data.rules : [];
    const outputs = rules.map((_, idx) => `case ${idx + 1}`).concat("fallback");
    return { inputs: ["input"], outputs };
  }
  return NODE_SCHEMA[node.type] || { inputs: [], outputs: [] };
}

export function Inspector({
  selectedNode,
  updateSelectedNodeLabel,
  updateData,
  onDelete,
  isExpandedDialogOpen: isExpandedProp,
  setIsExpandedDialogOpen: setIsExpandedProp,
  onTogglePin,
}: InspectorProps) {
  const [isExpandedInternal, setIsExpandedInternal] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Decide whether to use external or internal state
  const isExpandedDialogOpen = isExpandedProp ?? isExpandedInternal;
  const setIsExpandedDialogOpen = setIsExpandedProp ?? setIsExpandedInternal;

  // Memoize inputs/outputs computation
  const nodeIO = useMemo(
    () => (selectedNode ? getNodeInputsOutputs(selectedNode) : null),
    [selectedNode],
  );

  const handleDelete = () => {
    setIsDeleteConfirmOpen(false);
    setIsExpandedDialogOpen(false);
    onDelete?.();
  };

  return (
    <>
      {/* Compact Inspector Panel */}
      <Panel
        position="top-right"
        className="pointer-events-auto !right-4 !top-4"
      >
        <div className="w-[260px] max-w-[90vw] rounded-[var(--radius)] border border-border/60 bg-card/90 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 p-3 pb-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Inspector
            </div>
            {selectedNode && (
              <div className="flex items-center gap-1">
                {onTogglePin && (
                  <button
                    onClick={() => onTogglePin(selectedNode.id)}
                    title={selectedNode.data.pinned ? "Unpin node" : "Pin node"}
                    className={`flex h-6 w-6 items-center justify-center rounded-[calc(var(--radius)-0.25rem)] transition-colors ${
                      selectedNode.data.pinned
                        ? "bg-ring/20 text-ring hover:bg-ring/30"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {selectedNode.data.pinned ? (
                      <PinOff className="h-3.5 w-3.5" />
                    ) : (
                      <Pin className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setIsExpandedDialogOpen(true)}
                  title="Expand inspector"
                  className="flex h-6 w-6 items-center justify-center rounded-[calc(var(--radius)-0.25rem)] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                {onDelete && (
                  <button
                    onClick={onDelete}
                    title="Delete node"
                    className="flex h-6 w-6 items-center justify-center rounded-[calc(var(--radius)-0.25rem)] text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {selectedNode ? (
            <>
              {/* Node Info */}
              <div className="border-b border-border/40 px-3 py-2">
                <div className="text-sm font-medium text-foreground">
                  {selectedNode.type} • {selectedNode.id.slice(0, 6)}
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto p-3">
                <div className="space-y-3">
                  {/* Label */}
                  <div className="space-y-2">
                    <label className="block text-xs text-muted-foreground">
                      Label
                    </label>
                    <input
                      className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
                      value={selectedNode.data.label ?? ""}
                      onChange={(e) => updateSelectedNodeLabel(e.target.value)}
                    />
                  </div>

                  {/* Type-specific inspector */}
                  {renderInspectorForm(selectedNode, updateData, false)}
                </div>
              </div>

              {/* Footer Hint */}
              <div className="border-t border-border/40 px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  Double-click to expand.
                </div>
              </div>
            </>
          ) : (
            <div className="p-3 text-sm text-muted-foreground">
              Select a node to edit its properties.
            </div>
          )}
        </div>
      </Panel>

      {/* Expanded Inspector Dialog */}
      {selectedNode && (
        <Dialog
          open={isExpandedDialogOpen}
          onOpenChange={setIsExpandedDialogOpen}
        >
          <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden p-0">
            {/* Dialog Header */}
            <DialogHeader className="shrink-0 border-b border-border/40 p-6 pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                    Configure {selectedNode.type} Node
                  </DialogTitle>
                  <div className="text-sm text-muted-foreground">
                    ID: {selectedNode.id} • Type: {selectedNode.type}
                  </div>
                </div>
              </div>
            </DialogHeader>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Label Section */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Basic Information
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Node Label
                    </label>
                    <input
                      className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80"
                      value={selectedNode.data.label ?? ""}
                      onChange={(e) => updateSelectedNodeLabel(e.target.value)}
                      placeholder="Enter a descriptive label"
                    />
                    <div className="text-xs text-muted-foreground">
                      A friendly name to identify this node in your workflow
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Parameters Section */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Configuration
                  </div>
                  {renderInspectorForm(selectedNode, updateData, true)}
                </div>

                <Separator />

                {/* Inputs/Outputs Section */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Inputs & Outputs
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Inputs */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        <span>Inputs</span>
                      </div>
                      <div className="space-y-2">
                        {nodeIO && nodeIO.inputs.length > 0 ? (
                          nodeIO.inputs.map((input) => (
                            <div
                              key={input}
                              className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground"
                            >
                              {input}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No inputs
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Outputs */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <ArrowRightLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                        <span>Outputs</span>
                      </div>
                      <div className="space-y-2">
                        {nodeIO && nodeIO.outputs.length > 0 ? (
                          nodeIO.outputs.map((output) => (
                            <div
                              key={output}
                              className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground"
                            >
                              {output}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No outputs
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 border-t border-border/40 p-6 pt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Changes are saved automatically
                </div>
                <div className="flex gap-2">
                  {onTogglePin && (
                    <button
                      onClick={() => onTogglePin(selectedNode.id)}
                      className={`inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border px-4 text-sm transition-colors ${
                        selectedNode.data.pinned
                          ? "border-ring/40 bg-ring/10 text-ring hover:bg-ring/20"
                          : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {selectedNode.data.pinned ? (
                        <>
                          <PinOff className="h-4 w-4" />
                          Unpin Node
                        </>
                      ) : (
                        <>
                          <Pin className="h-4 w-4" />
                          Pin Node
                        </>
                      )}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      className="inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border border-destructive/40 bg-destructive/10 px-4 text-sm text-destructive transition-colors hover:bg-destructive/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Node
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Node
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this node? This action cannot be
              undone.
            </p>
            {selectedNode && (
              <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/30 p-3">
                <div className="text-sm font-medium text-foreground">
                  {selectedNode.type} • {selectedNode.data.label || selectedNode.id.slice(0, 6)}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="inline-flex h-9 items-center rounded-[calc(var(--radius)-0.25rem)] border border-input bg-background px-4 text-sm transition-colors hover:bg-muted/60"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex h-9 items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] bg-destructive px-4 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
