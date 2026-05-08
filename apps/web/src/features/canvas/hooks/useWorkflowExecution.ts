"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { useExecution } from "../context/ExecutionContext";
import { useRtesWebSocket, type WsConnectionStatus } from "./useRtesWebSocket";
import type { ExecutionState, RtesNodeUpdate } from "../types/execution";
import { runWorkflow } from "@/lib/api/workflows";
import { extractApiErrorMessage } from "@/lib/api/error";

export interface UseWorkflowExecutionOptions {
  workflowId: number | null;
}

export interface UseWorkflowExecutionReturn {
  executionState: ExecutionState;
  wsStatus: WsConnectionStatus;
  wsReconnectAttempts: number;
  isStarting: boolean;

  startExecution: (versionId?: number) => Promise<boolean>;
  stopExecution: () => void;
  reset: () => void;

  error: string | null;
}

export function useWorkflowExecution(
  options: UseWorkflowExecutionOptions,
): UseWorkflowExecutionReturn {
  const { workflowId } = options;

  const { state, dispatch } = useExecution();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsEnabled, setWsEnabled] = useState(false);

  const isMountedRef = useRef(true);

  const {
    status: wsStatus,
    reconnectAttempts: wsReconnectAttempts,
    disconnect,
  } = useRtesWebSocket({
    enabled: wsEnabled && !state.isHistorical,
    executionId: state.executionId,
    workflowId,
    onMessage: useCallback(
      (data: RtesNodeUpdate) => {
        dispatch({ type: "NODE_UPDATE", payload: data });
      },
      [dispatch],
    ),
    onError: useCallback((err: Event | Error) => {
      const errorMsg = err instanceof Error ? err.message : "WebSocket error";
      setError(errorMsg);
      toast.error("Real-time execution service disconnected.");
    }, []),
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const startExecution = useCallback(
    async (versionId?: number) => {
      if (!workflowId) {
        setError("No workflow ID provided");
        return false;
      }

      if (state.status === "running") {
        console.warn("[Execution] Already running");
        return false;
      }

      setIsStarting(true);
      setError(null);

      try {
        const response = await runWorkflow(workflowId, versionId);

        if (!isMountedRef.current) return false;

        if (response.error) {
          const errorMsg = extractApiErrorMessage(response.error, "Failed to start execution");
          throw new Error(errorMsg);
        }

        const executionId = response.data?.data;
        if (!executionId) {
          throw new Error("No execution ID returned from API");
        }

        dispatch({
          type: "START_EXECUTION",
          executionId,
          workflowId,
        });

        setWsEnabled(true);
        return true;
      } catch (err) {
        if (!isMountedRef.current) return false;

        // With throwOnError: true, the Hey API client throws the parsed JSON body
        // (e.g. { success, message, data }) — not an Error instance.
        const errorMsg = extractApiErrorMessage(err, "Failed to start execution");
        setError(errorMsg);
        toast.error(errorMsg);
        dispatch({ type: "SET_ERROR", error: errorMsg });
        return false;
      } finally {
        if (isMountedRef.current) {
          setIsStarting(false);
        }
      }
    },
    [workflowId, state.status, dispatch],
  );

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
    wsReconnectAttempts,
    isStarting,
    startExecution,
    stopExecution,
    reset,
    error,
  };
}

export default useWorkflowExecution;
