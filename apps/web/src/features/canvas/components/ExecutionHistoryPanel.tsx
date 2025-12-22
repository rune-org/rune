"use client";

import { useState, useEffect, useCallback } from "react";
import {
  History,
  Radio,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useExecution } from "../context/ExecutionContext";
import {
  fetchWorkflowExecutions,
  type RtesExecutionDocument,
} from "@/lib/api/rtes";
import type { ExecutionState, WorkflowExecutionStatus, NodeExecutionData } from "../types/execution";
import { parseNodeStatus } from "../types/execution";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ExecutionHistoryPanelProps {
  workflowId: number | null;
}

type ExecutionHistoryItem = {
  executionId: string;
  workflowId: number;
  status: WorkflowExecutionStatus;
  createdAt: string;
};

function getStatusIcon(status: WorkflowExecutionStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "running":
      return <Radio className="h-3.5 w-3.5 animate-pulse text-blue-500" />;
    case "halted":
      return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

/**
 * Convert RTES ExecutionDocument to frontend ExecutionState
 */
function rtesDocToExecutionState(doc: RtesExecutionDocument): ExecutionState {
  const nodesMap = new Map<string, NodeExecutionData>();

  // Convert nodes from RTES format
  for (const [nodeId, hydratedNode] of Object.entries(doc.nodes)) {
    const latest = hydratedNode.latest;
    if (latest) {
      nodesMap.set(nodeId, {
        nodeId,
        status: parseNodeStatus(latest.status),
        output: latest.output,
        error: latest.error ? { message: latest.error.message, code: latest.error.code } : undefined,
        executedAt: latest.executed_at,
        durationMs: latest.duration_ms,
      });
    }
  }

  return {
    executionId: doc.execution_id,
    workflowId: parseInt(doc.workflow_id, 10),
    status: (doc.status as WorkflowExecutionStatus) || "idle",
    nodes: nodesMap,
    startedAt: doc.created_at,
    isHistorical: true,
  };
}

function ExecutionHistoryListItem({
  item,
  isActive,
  isLive,
  onSelect,
}: {
  item: ExecutionHistoryItem;
  isActive: boolean;
  isLive: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors cursor-pointer",
        isActive
          ? "bg-muted/60 text-foreground"
          : "hover:bg-muted/40"
      )}
      onClick={onSelect}
    >
      {getStatusIcon(item.status)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs truncate">
            {item.executionId.slice(0, 8)}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-blue-500">
              <Radio className="h-2 w-2 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatRelativeTime(item.createdAt)}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

/**
 * Panel for browsing and loading past execution history from RTES.
 */
export function ExecutionHistoryPanel({ workflowId }: ExecutionHistoryPanelProps) {
  const { state, dispatch } = useExecution();
  const [history, setHistory] = useState<ExecutionHistoryItem[]>([]);
  const [rtesDocuments, setRtesDocuments] = useState<Map<string, RtesExecutionDocument>>(new Map());
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch history from RTES when popover opens
  const loadHistory = useCallback(async () => {
    if (!workflowId) {
      setHistory([]);
      return;
    }

    setIsLoading(true);
    try {
      const documents = await fetchWorkflowExecutions(workflowId);

      // Store full documents for later use
      const docMap = new Map<string, RtesExecutionDocument>();
      const items: ExecutionHistoryItem[] = [];

      for (const doc of documents) {
        docMap.set(doc.execution_id, doc);
        items.push({
          executionId: doc.execution_id,
          workflowId: parseInt(doc.workflow_id, 10),
          status: (doc.status as WorkflowExecutionStatus) || "idle",
          createdAt: doc.created_at || new Date().toISOString(),
        });
      }

      // Sort by created_at descending (most recent first)
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRtesDocuments(docMap);
      setHistory(items);
    } catch (error) {
      console.error("[ExecutionHistory] Failed to load:", error);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  const handleSelectExecution = (executionId: string) => {
    const doc = rtesDocuments.get(executionId);
    if (!doc) {
      console.warn("[ExecutionHistory] Document not found:", executionId);
      return;
    }

    const executionState = rtesDocToExecutionState(doc);
    dispatch({ type: "LOAD_STATE", state: executionState });
    setIsOpen(false);
  };

  const handleReturnToLive = () => {
    dispatch({ type: "RESET" });
    setIsOpen(false);
  };

  // Check if currently viewing a historical execution (not the live one)
  const isViewingHistory =
    state.executionId !== null &&
    state.status !== "running" &&
    state.isHistorical === true;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-muted/40 border-border/60 hover:bg-muted/60"
        >
          <History className="h-4 w-4" />
          History
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Execution History</h4>
          </div>
          {isViewingHistory && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-full gap-2"
              onClick={handleReturnToLive}
            >
              <Radio className="h-3 w-3" />
              Return to Live View
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                Loading history...
              </p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-6 text-center">
              <History className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No execution history yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Run the workflow to see past executions.
              </p>
            </div>
          ) : (
            <div className="p-1">
              {history.map((item, index) => {
                const isActive = state.executionId === item.executionId;
                const nextIsNotActive = history[index + 1] && state.executionId !== history[index + 1].executionId;
                return (
                  <div key={item.executionId}>
                    <ExecutionHistoryListItem
                      item={item}
                      isActive={isActive}
                      isLive={isActive && state.status === "running"}
                      onSelect={() => handleSelectExecution(item.executionId)}
                    />
                    {isActive && nextIsNotActive && (
                      <div className="my-1 mx-2 border-b border-border/60" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ExecutionHistoryPanel;
