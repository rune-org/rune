"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useNodeExecution, useNodeExecutions } from "../../context/ExecutionContext";
import {
  nodeExecutionInstanceKey,
  type NodeExecutionStatus,
  type NodeExecutionData,
} from "../../types/execution";
import type { NodeKind } from "../../types";
import { cn } from "@/lib/cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JsonTreeViewer } from "../json-tree/JsonTreeViewer";

interface RuntimeDataPanelProps {
  nodeId: string;
  nodeLabel?: string;
  nodeType?: NodeKind;
}

function StatusBadge({ status, durationMs }: { status: NodeExecutionStatus; durationMs?: number }) {
  const statusConfig = useMemo(() => {
    switch (status) {
      case "running":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: "Running",
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        };
      case "success":
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          text: "Success",
          className: "bg-green-500/10 text-green-600 dark:text-green-400",
        };
      case "failed":
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: "Failed",
          className: "bg-red-500/10 text-red-600 dark:text-red-400",
        };
      case "waiting":
        return {
          icon: <Clock className="h-4 w-4" />,
          text: "Waiting",
          className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
        };
      default:
        return {
          icon: null,
          text: "Idle",
          className: "bg-muted text-muted-foreground",
        };
    }
  }, [status]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
        statusConfig.className,
      )}
    >
      {statusConfig.icon}
      <span>{statusConfig.text}</span>
      {durationMs !== undefined && (
        <span className="ml-auto flex items-center gap-1 text-xs opacity-70">
          <Clock className="h-3 w-3" />
          {durationMs}ms
        </span>
      )}
    </div>
  );
}

function JsonSection({
  label,
  data,
  nodeLabel,
}: {
  label: string;
  data: unknown;
  nodeLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(label === "Output");
  const [viewMode, setViewMode] = useState<"tree" | "json">("tree");

  const jsonString = useMemo(() => {
    if (data === undefined || data === null) return "";
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const preview = useMemo(() => {
    if (data === undefined || data === null) return "";
    const str = JSON.stringify(data);
    if (str.length > 60) {
      return str.slice(0, 60) + "...";
    }
    return str;
  }, [data]);

  if (data === undefined || data === null) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    toast.success("Copied to clipboard");
  };

  const rootPath = nodeLabel ? `$${nodeLabel}` : "";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-1">
      <div className="flex items-center gap-2">
        <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-xs font-medium uppercase text-muted-foreground hover:text-foreground transition-colors">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {label}
          {!isOpen && (
            <span className="ml-2 truncate text-[10px] font-normal opacity-60">{preview}</span>
          )}
        </CollapsibleTrigger>
        {isOpen && (
          <div className="flex items-center gap-1">
            <div className="flex overflow-hidden rounded border border-border/60">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={cn(
                  "px-1.5 py-0.5 text-[10px] transition-colors",
                  viewMode === "tree"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Tree
              </button>
              <button
                type="button"
                onClick={() => setViewMode("json")}
                className={cn(
                  "border-l border-border/60 px-1.5 py-0.5 text-[10px] transition-colors",
                  viewMode === "json"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                JSON
              </button>
            </div>
            <button
              onClick={handleCopy}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy to clipboard"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <CollapsibleContent>
        <div className="max-h-96 overflow-auto rounded-md border border-border/40 bg-muted/30 p-2">
          {viewMode === "tree" ? (
            <JsonTreeViewer data={data} rootPath={rootPath} defaultExpandDepth={2} maxDepth={50} />
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">
              {jsonString}
            </pre>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ErrorDisplay({ error }: { error: NodeExecutionData["error"] }) {
  if (!error) return null;

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase text-red-600">Error</div>
      <div className="rounded-md bg-red-500/10 p-3 text-xs">
        <div className="font-medium text-red-600 dark:text-red-400">{error.message}</div>
        {error.code && (
          <div className="mt-1 text-red-600/70 dark:text-red-400/70">Code: {error.code}</div>
        )}
        {error.details !== undefined && (
          <pre className="mt-2 max-h-32 overflow-auto rounded bg-red-500/10 p-2 font-mono text-[10px]">
            {typeof error.details === "string"
              ? error.details
              : JSON.stringify(error.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function executionOptionLabel(execution: NodeExecutionData, fallbackIndex: number): string {
  if (execution.itemIndex !== undefined) {
    const itemNumber = execution.itemIndex + 1;
    return execution.totalItems !== undefined
      ? `Item ${itemNumber} of ${execution.totalItems}`
      : `Item ${itemNumber}`;
  }
  if (execution.branchId) return `Branch ${fallbackIndex + 1}`;
  return `Run ${fallbackIndex + 1}`;
}

function sortNodeExecutions(executions: NodeExecutionData[]): NodeExecutionData[] {
  return [...executions].sort((a, b) => {
    if (a.itemIndex !== undefined && b.itemIndex !== undefined) {
      return a.itemIndex - b.itemIndex;
    }
    if (a.itemIndex !== undefined) return -1;
    if (b.itemIndex !== undefined) return 1;
    return nodeExecutionInstanceKey(a).localeCompare(nodeExecutionInstanceKey(b));
  });
}

export function RuntimeDataPanel({ nodeId, nodeLabel, nodeType }: RuntimeDataPanelProps) {
  const nodeExecution = useNodeExecution(nodeId);
  const nodeExecutions = useNodeExecutions(nodeId);
  const sortedExecutions = useMemo(() => sortNodeExecutions(nodeExecutions), [nodeExecutions]);
  const [selectedExecutionKey, setSelectedExecutionKey] = useState<string | null>(null);
  const showExecutionSelector = nodeType !== "aggregator" && sortedExecutions.length > 1;

  useEffect(() => {
    if (sortedExecutions.length === 0) {
      setSelectedExecutionKey(null);
      return;
    }

    setSelectedExecutionKey((current) => {
      if (
        current &&
        sortedExecutions.some((execution) => nodeExecutionInstanceKey(execution) === current)
      ) {
        return current;
      }
      return nodeExecutionInstanceKey(sortedExecutions[0]);
    });
  }, [sortedExecutions]);

  const selectedSplitExecution = showExecutionSelector
    ? (sortedExecutions.find(
        (execution) => nodeExecutionInstanceKey(execution) === selectedExecutionKey,
      ) ?? sortedExecutions[0])
    : undefined;
  const selectedExecution = selectedSplitExecution ?? nodeExecution;
  const displayedError = selectedSplitExecution
    ? selectedSplitExecution.error
    : nodeExecution?.error;

  if (!nodeExecution || nodeExecution.status === "idle") {
    return (
      <div className="rounded-md border border-dashed border-muted p-6 text-center">
        <div className="text-sm text-muted-foreground">No execution data yet.</div>
        <div className="mt-1 text-xs text-muted-foreground/70">
          Run the workflow to see runtime values.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatusBadge
        status={selectedExecution?.status ?? nodeExecution.status}
        durationMs={selectedExecution?.durationMs ?? nodeExecution.durationMs}
      />

      {showExecutionSelector && (
        <div className="rounded-md border border-border/50 bg-muted/20 p-2">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Split iteration
          </label>
          <Select value={selectedExecutionKey ?? ""} onValueChange={setSelectedExecutionKey}>
            <SelectTrigger className="mt-1 h-8 rounded border-border/70 bg-background/80 px-2 py-1 text-xs">
              <SelectValue placeholder="Select iteration" />
            </SelectTrigger>
            <SelectContent>
              {sortedExecutions.map((execution, index) => {
                const key = nodeExecutionInstanceKey(execution);
                return (
                  <SelectItem key={key} value={key} className="text-xs">
                    {executionOptionLabel(execution, index)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <JsonSection label="Input" data={selectedExecution?.input} nodeLabel={nodeLabel} />
      <JsonSection label="Parameters" data={selectedExecution?.parameters} nodeLabel={nodeLabel} />
      <JsonSection label="Output" data={selectedExecution?.output} nodeLabel={nodeLabel} />

      <ErrorDisplay error={displayedError} />

      {(selectedExecution?.executedAt ?? nodeExecution.executedAt) && (
        <div className="border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="font-medium">Executed:</span>{" "}
          {new Date(selectedExecution?.executedAt ?? nodeExecution.executedAt!).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default RuntimeDataPanel;
