"use client";

import { useState, useMemo } from "react";
import { Panel } from "@xyflow/react";
import {
  Maximize2,
  Trash2,
  ArrowRightLeft,
  Settings,
} from "lucide-react";
import type { CanvasNode } from "../types";
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

type InspectorProps = {
  selectedNode: CanvasNode | null;
  updateSelectedNodeLabel: (value: string) => void;
  updateData: ReturnType<typeof useUpdateNodeData>;
  onDelete?: () => void;
};

function renderInspectorForm(
  node: CanvasNode,
  updateData: ReturnType<typeof useUpdateNodeData>,
  isExpanded: boolean,
) {
  const commonProps = { node, updateData, isExpanded };

  switch (node.type) {
    case "http":
      return <HttpInspector {...commonProps} />;
    case "if":
      return <IfInspector {...commonProps} />;
    case "smtp":
      return <SmtpInspector {...commonProps} />;
    default:
      return null;
  }
}

function getNodeInputsOutputs(node: CanvasNode): {
  inputs: string[];
  outputs: string[];
} {
  switch (node.type) {
    case "trigger":
      return { inputs: [], outputs: ["trigger"] };
    case "agent":
      return { inputs: ["input"], outputs: ["response"] };
    case "if":
      return { inputs: ["condition"], outputs: ["true", "false"] };
    case "http":
      return { inputs: ["request"], outputs: ["response", "error"] };
    case "smtp":
      return { inputs: ["email"], outputs: ["sent", "error"] };
    default:
      return { inputs: [], outputs: [] };
  }
}

export function Inspector({
  selectedNode,
  updateSelectedNodeLabel,
  updateData,
  onDelete,
}: InspectorProps) {
  const [isExpandedDialogOpen, setIsExpandedDialogOpen] = useState(false);

  // Memoize inputs/outputs computation
  const nodeIO = useMemo(
    () => (selectedNode ? getNodeInputsOutputs(selectedNode) : null),
    [selectedNode],
  );

  return (
    <>
      {/* Compact Inspector Panel */}
      <Panel
        position="top-right"
        className="pointer-events-auto !right-4 !top-4"
      >
        <div className="w-[260px] rounded-[var(--radius)] border border-border/60 bg-card/90 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 p-3 pb-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Inspector
            </div>
            {selectedNode && (
              <button
                onClick={() => setIsExpandedDialogOpen(true)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-[calc(var(--radius)-0.25rem)] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                title="Expand inspector"
                aria-label="Expand inspector"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
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
                  Delete key removes selected.
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
                  {onDelete && (
                    <button
                      onClick={() => {
                        setIsExpandedDialogOpen(false);
                        onDelete();
                      }}
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
    </>
  );
}
