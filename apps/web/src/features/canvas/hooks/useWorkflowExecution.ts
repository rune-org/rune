"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useExecution } from "../context/ExecutionContext";
import { useRtesWebSocket, type WsConnectionStatus } from "./useRtesWebSocket";
import type { ExecutionState, RtesNodeUpdate } from "../types/execution";
import { runWorkflow } from "@/lib/api/workflows";

export interface UseWorkflowExecutionOptions {
  /** Workflow ID to execute */
  workflowId: number | null;
}

export interface UseWorkflowExecutionReturn {
  executionState: ExecutionState;
  wsStatus: WsConnectionStatus;
  isStarting: boolean;

  startExecution: () => Promise<void>;
  stopExecution: () => void;
  reset: () => void;

  /** Last error that occurred */
  error: string | null;
}

/**
 * Hook for orchestrating workflow execution.
 *
 * Combines:
 * - API call to /run endpoint
 * - WebSocket connection management
 * - Execution context dispatch
 *
 * Execution history is stored by RTES and fetched via the ExecutionHistoryPanel.
 *
 * @example
 * ```tsx
 * const {
 *   executionState,
 *   wsStatus,
 *   isStarting,
 *   startExecution,
 *   reset,
 * } = useWorkflowExecution({ workflowId: 123 });
 * ```
 */
export function useWorkflowExecution(
  options: UseWorkflowExecutionOptions
): UseWorkflowExecutionReturn {
  const { workflowId } = options;

  const { state, dispatch } = useExecution();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsEnabled, setWsEnabled] = useState(false);

  // Refs for cleanup
  const isMountedRef = useRef(true);

  // WebSocket connection - disabled when viewing historical executions
  const { status: wsStatus, disconnect } = useRtesWebSocket({
    enabled: wsEnabled && !state.isHistorical,
    executionId: state.executionId,
    workflowId,
    onMessage: useCallback(
      (data: RtesNodeUpdate) => {
        dispatch({ type: "NODE_UPDATE", payload: data });
      },
      [dispatch]
    ),
    onError: useCallback((err: Event | Error) => {
      console.error("[Execution] WebSocket error:", err);
      setError(err instanceof Error ? err.message : "WebSocket error");
    }, []),
  });

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Start a new workflow execution.
   */
  const startExecution = useCallback(async () => {
    if (!workflowId) {
      setError("No workflow ID provided");
      return;
    }

    if (state.status === "running") {
      console.warn("[Execution] Already running");
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      // Call the /run endpoint
      const response = await runWorkflow(workflowId);

      if (!isMountedRef.current) return;

      if (response.error) {
        const errorMsg =
          typeof response.error === "object" && "detail" in response.error
            ? String((response.error as { detail: unknown }).detail)
            : "Failed to start execution";
        throw new Error(errorMsg);
      }

      // Extract execution_id from response
      const executionId = response.data?.data;
      if (!executionId) {
        throw new Error("No execution ID returned from API");
      }

      console.log("[Execution] Started:", executionId);

      // Dispatch start action
      dispatch({
        type: "START_EXECUTION",
        executionId,
        workflowId,
      });

      // Enable WebSocket connection
      setWsEnabled(true);
    } catch (err) {
      if (!isMountedRef.current) return;

      console.error("[Execution] Failed to start:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to start execution";
      setError(errorMsg);
      dispatch({ type: "SET_ERROR", error: errorMsg });
    } finally {
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [workflowId, state.status, dispatch]);

  /**
   * Stop the current execution.
   * Note: This disconnects the WebSocket but doesn't actually stop the backend execution.
   * TODO(rtes): Add backend support for stopping executions
   */
  const stopExecution = useCallback(() => {
    setWsEnabled(false);
    disconnect();
    dispatch({
      type: "WORKFLOW_COMPLETE",
      status: "halted",
    });
  }, [disconnect, dispatch]);

  /**
   * Reset execution state.
   */
  const reset = useCallback(() => {
    setWsEnabled(false);
    setError(null);
    disconnect();
    dispatch({ type: "RESET" });
  }, [disconnect, dispatch]);

  return {
    executionState: state,
    wsStatus,
    isStarting,
    startExecution,
    stopExecution,
    reset,
    error,
  };
}

export default useWorkflowExecution;
