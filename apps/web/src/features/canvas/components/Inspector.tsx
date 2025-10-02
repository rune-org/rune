"use client";

import { Panel } from "@xyflow/react";
import type { CanvasNode } from "../types";
import { JsonField } from "./JsonField";
import { useUpdateNodeData } from "../hooks/useUpdateNodeData";

type InspectorProps = {
  selectedNode: CanvasNode | null;
  setNodes: (
    updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[],
  ) => void;
  updateSelectedNodeLabel: (value: string) => void;
};

// Currently, inspector is a very basic implementation; conditional rendering based on node type.
// In the future, we might want to have a more scalable approach, e.g., registering field components per node type, or using a form library instead of the current minimal approach.

export function Inspector({
  selectedNode,
  setNodes,
  updateSelectedNodeLabel,
}: InspectorProps) {
  const updateData = useUpdateNodeData(setNodes);
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

            {selectedNode.type === "if" && (
              <div className="space-y-2">
                <label className="block text-xs text-muted-foreground">
                  Expression
                </label>
                <input
                  className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
                  value={selectedNode.data.expression ?? ""}
                  onChange={(e) =>
                    updateData(selectedNode.id, "if", (d) => ({
                      ...d,
                      expression: e.target.value,
                    }))
                  }
                />
                <div className="text-xs text-muted-foreground">
                  Two outputs: true and false.
                </div>
              </div>
            )}

            {selectedNode.type === "http" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted-foreground">
                      Method
                    </label>
                    <select
                      className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
                      value={selectedNode.data.method ?? "GET"}
                      onChange={(e) =>
                        updateData(selectedNode.id, "http", (d) => ({
                          ...d,
                          method: e.target.value,
                        }))
                      }
                    >
                      {"GET POST PUT PATCH DELETE".split(" ").map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground">
                      Timeout (s)
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
                      value={selectedNode.data.timeout ?? 30}
                      onChange={(e) =>
                        updateData(selectedNode.id, "http", (d) => ({
                          ...d,
                          timeout: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground">
                    URL
                  </label>
                  <input
                    className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
                    value={selectedNode.data.url ?? ""}
                    onChange={(e) =>
                      updateData(selectedNode.id, "http", (d) => ({
                        ...d,
                        url: e.target.value,
                      }))
                    }
                    placeholder="https://api.example.com/path"
                  />
                </div>
                <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Headers (JSON object)
                  </summary>
                  <JsonField
                    value={selectedNode.data.headers}
                    onChange={(obj) =>
                      updateData(selectedNode.id, "http", (d) => ({
                        ...d,
                        headers: obj,
                      }))
                    }
                  />
                </details>
                <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Query Params (JSON object)
                  </summary>
                  <JsonField
                    value={selectedNode.data.query}
                    onChange={(obj) =>
                      updateData(selectedNode.id, "http", (d) => ({
                        ...d,
                        query: obj,
                      }))
                    }
                  />
                </details>
                <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Body (JSON)
                  </summary>
                  <JsonField
                    value={selectedNode.data.body}
                    onChange={(obj) =>
                      updateData(selectedNode.id, "http", (d) => ({
                        ...d,
                        body: obj,
                      }))
                    }
                  />
                </details>
                <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Advanced
                  </summary>
                  <div className="mt-2 space-y-2 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedNode.data.ignoreSSL ?? false}
                        onChange={(e) =>
                          updateData(selectedNode.id, "http", (d) => ({
                            ...d,
                            ignoreSSL: e.target.checked,
                          }))
                        }
                      />
                      Ignore SSL
                    </label>
                    <label className="block">Retries</label>
                    <input
                      type="number"
                      className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1"
                      value={selectedNode.data.retries ?? 0}
                      onChange={(e) =>
                        updateData(selectedNode.id, "http", (d) => ({
                          ...d,
                          retries: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </details>
              </div>
            )}

            {selectedNode.type === "smtp" && (
              <div className="space-y-2">
                <label className="block text-xs text-muted-foreground">
                  To
                </label>
                <input
                  className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
                  value={selectedNode.data.to ?? ""}
                  onChange={(e) =>
                    updateData(selectedNode.id, "smtp", (d) => ({
                      ...d,
                      to: e.target.value,
                    }))
                  }
                />
                <label className="block text-xs text-muted-foreground">
                  Subject
                </label>
                <input
                  className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
                  value={selectedNode.data.subject ?? ""}
                  onChange={(e) =>
                    updateData(selectedNode.id, "smtp", (d) => ({
                      ...d,
                      subject: e.target.value,
                    }))
                  }
                />
              </div>
            )}

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
