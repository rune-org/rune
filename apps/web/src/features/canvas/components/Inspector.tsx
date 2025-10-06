"use client";

import { Panel } from "@xyflow/react";
import type { CanvasNode } from "../types";
import { useUpdateNodeData } from "../hooks/useUpdateNodeData";

import { IfInspector } from "./inspectors/IfInspector";
import { HttpInspector } from "./inspectors/HttpInspector";
import { SmtpInspector } from "./inspectors/SmtpInspector";

type InspectorProps = {
  selectedNode: CanvasNode | null;
  updateSelectedNodeLabel: (value: string) => void;
  updateData: ReturnType<typeof useUpdateNodeData>;
};

function renderInspectorForm(
  node: CanvasNode,
  updateData: ReturnType<typeof useUpdateNodeData>,
) {
  switch (node.type) {
    case "http":
      return <HttpInspector node={node} updateData={updateData} />;
    case "if":
      return <IfInspector node={node} updateData={updateData} />;
    case "smtp":
      return <SmtpInspector node={node} updateData={updateData} />;
    default:
      return null;
  }
}

export function Inspector({
  selectedNode,
  updateSelectedNodeLabel,
  updateData,
}: InspectorProps) {
  return (
    <Panel position="top-right" className="pointer-events-auto !right-4 !top-4">
      <div className="w-[260px] rounded-[var(--radius)] border border-border/60 bg-card/90 p-3 shadow-lg">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Inspector
        </div>
        {selectedNode ? (
          <div className="space-y-4">
            <div className="text-sm font-medium text-foreground">
              {selectedNode.type} • {selectedNode.id.slice(0, 6)}
            </div>
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

            {renderInspectorForm(selectedNode, updateData)}

            <div className="text-xs text-muted-foreground">
              Delete key removes selected.
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Select a node to edit its properties.
          </div>
        )}
      </div>
    </Panel>
  );
}
