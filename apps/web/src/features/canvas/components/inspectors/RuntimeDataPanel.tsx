"use client";

import { useMemo } from "react";
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
import { useNodeExecution } from "../../context/ExecutionContext";
import type { NodeExecutionStatus, NodeExecutionData } from "../../types/execution";
import { cn } from "@/lib/cn";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { JsonTreeViewer } from "../json-tree/JsonTreeViewer";

interface RuntimeDataPanelProps {
  nodeId: string;
  nodeLabel?: string;
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
    <div className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium", statusConfig.className)}>
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
  const [isOpen, setIsOpen] = useState(false);

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
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {label}
          {!isOpen && (
            <span className="ml-2 truncate text-[10px] font-normal opacity-60">
              {preview}
            </span>
          )}
        </CollapsibleTrigger>
        {isOpen && (
          <button
            onClick={handleCopy}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy to clipboard"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
      <CollapsibleContent>
        <div className="max-h-64 overflow-auto rounded-md bg-muted/30 p-2">
          <JsonTreeViewer
            data={data}
            rootPath={rootPath}
            defaultExpandDepth={2}
          />
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
        <div className="font-medium text-red-600 dark:text-red-400">
          {error.message}
        </div>
        {error.code && (
          <div className="mt-1 text-red-600/70 dark:text-red-400/70">
            Code: {error.code}
          </div>
        )}
        {error.details !== undefined && (
          <pre className="mt-2 max-h-32 overflow-auto rounded bg-red-500/10 p-2 font-mono text-[10px]">
            {typeof error.details === "string" ? error.details : JSON.stringify(error.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export function RuntimeDataPanel({ nodeId, nodeLabel }: RuntimeDataPanelProps) {
  const nodeExecution = useNodeExecution(nodeId);

  if (!nodeExecution || nodeExecution.status === "idle") {
    return (
      <div className="rounded-md border border-dashed border-muted p-6 text-center">
        <div className="text-sm text-muted-foreground">
          No execution data yet.
        </div>
        <div className="mt-1 text-xs text-muted-foreground/70">
          Run the workflow to see runtime values.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatusBadge status={nodeExecution.status} durationMs={nodeExecution.durationMs} />

      <JsonSection label="Input" data={nodeExecution.input} nodeLabel={nodeLabel} />
      <JsonSection label="Parameters" data={nodeExecution.parameters} nodeLabel={nodeLabel} />
      <JsonSection label="Output" data={nodeExecution.output} nodeLabel={nodeLabel} />

      <ErrorDisplay error={nodeExecution.error} />

      {nodeExecution.executedAt && (
        <div className="border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="font-medium">Executed:</span>{" "}
          {new Date(nodeExecution.executedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default RuntimeDataPanel;
