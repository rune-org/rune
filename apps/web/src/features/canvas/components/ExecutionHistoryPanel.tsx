"use client";

import { useState, useEffect, useCallback } from "react";
import {
  History,
  Trash2,
  Radio,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useExecution } from "../context/ExecutionContext";
import {
  getExecutionHistoryForWorkflow,
  snapshotToState,
  clearWorkflowHistory,
  deleteExecution,
} from "../stores/executionHistoryStore";
import type { ExecutionSnapshot } from "../types/execution";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ExecutionHistoryPanelProps {
  workflowId: number | null;
}

function getStatusIcon(status: ExecutionSnapshot["status"]) {
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

function ExecutionHistoryItem({
  snapshot,
  isActive,
  isLive,
  onSelect,
  onDelete,
}: {
  snapshot: ExecutionSnapshot;
  isActive: boolean;
  isLive: boolean;
  onSelect: () => void;
  onDelete: () => void;
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
      {getStatusIcon(snapshot.status)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs truncate">
            {snapshot.executionId.slice(0, 8)}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-blue-500">
              <Radio className="h-2 w-2 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatRelativeTime(snapshot.startedAt)}</span>
          {snapshot.totalDurationMs && (
            <>
              <span>·</span>
              <span>{snapshot.totalDurationMs}ms</span>
            </>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </Button>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

/**
 * Panel for browsing and loading past execution history.
 */
export function ExecutionHistoryPanel({ workflowId }: ExecutionHistoryPanelProps) {
  const { state, dispatch } = useExecution();
  const [history, setHistory] = useState<ExecutionSnapshot[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Reload history when popover opens or workflowId changes
  const loadHistory = useCallback(() => {
    if (workflowId) {
      setHistory(getExecutionHistoryForWorkflow(workflowId));
    } else {
      setHistory([]);
    }
  }, [workflowId]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  const handleSelectExecution = (snapshot: ExecutionSnapshot) => {
    const executionState = snapshotToState(snapshot);
    dispatch({ type: "LOAD_STATE", state: executionState });
    setIsOpen(false);
  };

  const handleDeleteExecution = (executionId: string) => {
    deleteExecution(executionId);
    loadHistory();
  };

  const handleClearHistory = () => {
    if (workflowId) {
      clearWorkflowHistory(workflowId);
      loadHistory();
    }
  };

  const handleReturnToLive = () => {
    dispatch({ type: "RESET" });
    setIsOpen(false);
  };

  // Check if currently viewing a historical execution (not the live one)
  const isViewingHistory =
    state.executionId !== null &&
    state.status !== "running" &&
    history.some((h) => h.executionId === state.executionId);

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
          {history.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {history.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Execution History</h4>
            {history.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Trash2 className="mr-1 h-3 w-3" />
                    Clear
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear execution history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all {history.length} execution records for this workflow. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearHistory}>
                      Clear History
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
          {history.length === 0 ? (
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
              {history.map((snapshot, index) => {
                const isActive = state.executionId === snapshot.executionId;
                const nextIsNotActive = history[index + 1] && state.executionId !== history[index + 1].executionId;
                return (
                  <div key={snapshot.executionId}>
                    <ExecutionHistoryItem
                      snapshot={snapshot}
                      isActive={isActive}
                      isLive={isActive && state.status === "running"}
                      onSelect={() => handleSelectExecution(snapshot)}
                      onDelete={() => handleDeleteExecution(snapshot.executionId)}
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
