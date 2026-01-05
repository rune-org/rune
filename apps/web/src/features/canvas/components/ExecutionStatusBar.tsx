"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Clock, X } from "lucide-react";
import { useExecution } from "../context/ExecutionContext";
import type { WorkflowExecutionStatus } from "../types/execution";
import { cn } from "@/lib/cn";

const AUTO_DISMISS_DELAY = 5000;

interface StatusConfig {
  icon: React.ReactNode;
  text: string;
  className: string;
  ariaLabel: string;
}

function getStatusConfig(
  status: WorkflowExecutionStatus,
  error?: string,
  totalDurationMs?: number
): StatusConfig | null {
  switch (status) {
    case "running":
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />,
        text: "Executing workflow...",
        className: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
        ariaLabel: "Workflow execution in progress",
      };
    case "completed":
      return {
        icon: <CheckCircle className="h-4 w-4" aria-hidden="true" />,
        text: totalDurationMs
          ? `Completed in ${totalDurationMs}ms`
          : "Workflow completed",
        className: "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400",
        ariaLabel: totalDurationMs
          ? `Workflow completed successfully in ${totalDurationMs} milliseconds`
          : "Workflow completed successfully",
      };
    case "failed":
      return {
        icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
        text: error ?? "Workflow failed",
        className: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
        ariaLabel: `Workflow failed: ${error ?? "Unknown error"}`,
      };
    case "halted":
      return {
        icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
        text: "Workflow halted",
        className: "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400",
        ariaLabel: "Workflow execution halted",
      };
    case "idle":
    default:
      return null;
  }
}

/**
 * Floating status bar showing workflow execution state.
 * Appears at the bottom-center of the canvas during/after execution.
 * Auto-dismisses after completion/failure/halt.
 */
export function ExecutionStatusBar() {
  const { state } = useExecution();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const statusConfig = useMemo(
    () => getStatusConfig(state.status, state.error, state.totalDurationMs),
    [state.status, state.error, state.totalDurationMs]
  );

  // Dismiss with animation
  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsDismissed(true);
      setIsExiting(false);
    }, 300);
  }, []);

  // Reset dismissed state when a new execution starts
  useEffect(() => {
    if (state.status === "running") {
      setIsDismissed(false);
      setIsExiting(false);
    }
  }, [state.status]);

  // Auto-dismiss after completion/failure/halt
  useEffect(() => {
    if (
      state.status === "completed" ||
      state.status === "failed" ||
      state.status === "halted"
    ) {
      const timer = setTimeout(dismiss, AUTO_DISMISS_DELAY);
      return () => clearTimeout(timer);
    }
  }, [state.status, dismiss]);

  // Don't render if idle or dismissed
  if (!statusConfig || isDismissed) {
    return null;
  }

  // Count completed/total nodes
  const totalNodes = state.nodes.size;
  const completedNodes = Array.from(state.nodes.values()).filter(
    (n) => n.status === "success" || n.status === "failed"
  ).length;
  const runningNodes = Array.from(state.nodes.values()).filter(
    (n) => n.status === "running"
  ).length;

  const canDismiss = state.status !== "running";

  return (
    <div
      className={cn(
        "absolute bottom-17 left-1/2 z-50 -translate-x-1/2 transform transition-all duration-300",
        isExiting && "opacity-0 translate-y-2"
      )}
    >
      <div
        role="status"
        aria-live="polite"
        aria-label={statusConfig.ariaLabel}
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-300",
          statusConfig.className
        )}
      >
        {statusConfig.icon}
        <span className="text-sm font-medium">{statusConfig.text}</span>

        {state.status === "running" && totalNodes > 0 && (
          <>
            <div className="mx-2 h-4 w-px bg-current opacity-20" />
            <div className="flex items-center gap-2 text-xs opacity-80">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span aria-label={`${completedNodes} of ${totalNodes} nodes completed${runningNodes > 0 ? `, ${runningNodes} currently running` : ""}`}>
                {completedNodes}/{totalNodes} nodes
                {runningNodes > 0 && ` (${runningNodes} running)`}
              </span>
            </div>
          </>
        )}

        {state.executionId && (
          <div
            className="ml-2 rounded bg-current/10 px-2 py-0.5 text-[10px] font-mono opacity-60"
            aria-label={`Execution ID: ${state.executionId}`}
            title={state.executionId}
          >
            {state.executionId.slice(0, 8)}...
          </div>
        )}

        {canDismiss && (
          <button
            onClick={dismiss}
            className="ml-1 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Dismiss status notification"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ExecutionStatusBar;
