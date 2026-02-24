"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import type { RtesNodeUpdate } from "../types/execution";

// WebSocket connection status
export type WsConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "reconnecting";

export interface UseRtesWebSocketOptions {
  /** Whether the WebSocket should be enabled */
  enabled: boolean;
  /** Execution ID to filter messages for */
  executionId: string | null;
  /** Workflow ID for context */
  workflowId: number | null;
  /** Callback when a message is received */
  onMessage?: (data: RtesNodeUpdate) => void;
  /** Callback when connection status changes */
  onStatusChange?: (status: WsConnectionStatus) => void;
  /** Callback when an error occurs */
  onError?: (error: Event | Error) => void;
}

export interface UseRtesWebSocketReturn {
  /** Current connection status */
  status: WsConnectionStatus;
  /** Manually connect to WebSocket */
  connect: () => void;
  /** Manually disconnect from WebSocket */
  disconnect: () => void;
  /** Whether the connection is active */
  isConnected: boolean;
  /** Last error that occurred */
  lastError: Error | null;
}

// Default RTES WebSocket URL
const DEFAULT_RTES_URL =
  process.env.NEXT_PUBLIC_RTES_WS_URL || "ws://localhost:3001/rt";

// Reconnection config
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
// Initial delay before first connection to allow token to be stored in Redis
const INITIAL_CONNECTION_DELAY = 500; // 500ms

/**
 * Hook for managing WebSocket connection to RTES.
 *
 * Handles:
 * - Connection lifecycle (connect, disconnect)
 * - Automatic reconnection with exponential backoff
 * - Message parsing and dispatching
 * - Connection status tracking
 *
 * @example
 * ```tsx
 * const { status, connect, disconnect } = useRtesWebSocket({
 *   enabled: true,
 *   executionId: "exec_123",
 *   workflowId: 1,
 *   onMessage: (data) => dispatch({ type: "NODE_UPDATE", payload: data }),
 * });
 * ```
 */
export function useRtesWebSocket(
  options: UseRtesWebSocketOptions
): UseRtesWebSocketReturn {
  const { enabled, executionId, workflowId, onMessage, onStatusChange, onError } =
    options;

  const [status, setStatus] = useState<WsConnectionStatus>("disconnected");
  const [lastError, setLastError] = useState<Error | null>(null);

  // Refs for WebSocket and reconnection state
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialConnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Update status and notify
  const updateStatus = useCallback(
    (newStatus: WsConnectionStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
      MAX_RECONNECT_DELAY
    );
    return delay;
  }, []);

  // Clean up WebSocket and timeouts
  const cleanup = useCallback(() => {
    if (initialConnectTimeoutRef.current) {
      clearTimeout(initialConnectTimeoutRef.current);
      initialConnectTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    cleanup();
    updateStatus("connecting");

    try {
      // Pass execution_id and workflow_id as query params for RTES token validation
      const params = new URLSearchParams();
      if (executionId) params.set("execution_id", executionId);
      if (workflowId) params.set("workflow_id", String(workflowId));
      const wsUrl = `${DEFAULT_RTES_URL}${params.toString() ? `?${params.toString()}` : ""}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!mountedRef.current) return;
        reconnectAttemptRef.current = 0;
        updateStatus("connected");
        setLastError(null);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data) as RtesNodeUpdate;
          onMessage?.(data);
        } catch (parseError) {
          // Silent failure - invalid message format
        }
      };

      ws.onerror = (event) => {
        if (!mountedRef.current) return;
        const error = new Error("WebSocket connection error");
        setLastError(error);
        toast.error("Connection error - attempting to reconnect");
        onError?.(event);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;

        // Attempt to reconnect if not a clean close and we haven't exceeded max attempts
        if (
          enabled &&
          !event.wasClean &&
          reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          const delay = getReconnectDelay();
          updateStatus("reconnecting");
          reconnectAttemptRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && enabled) {
              connect();
            }
          }, delay);
        } else if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          toast.error("Unable to connect to execution service", {
            action: {
              label: "Retry",
              onClick: () => {
                reconnectAttemptRef.current = 0;
                connect();
              },
            },
          });
          updateStatus("error");
          setLastError(new Error("Max reconnect attempts reached"));
        } else {
          updateStatus("disconnected");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      toast.error("Failed to connect to execution service", {
        action: {
          label: "Retry",
          onClick: () => connect(),
        },
      });
      updateStatus("error");
      setLastError(error instanceof Error ? error : new Error(String(error)));
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [enabled, executionId, workflowId, cleanup, updateStatus, onMessage, onError, getReconnectDelay]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    reconnectAttemptRef.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    cleanup();
    updateStatus("disconnected");
  }, [cleanup, updateStatus]);

  // Connect/disconnect based on enabled state
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && executionId) {
      // Add initial delay to allow token to be stored in Redis before connecting
      // This prevents race condition where frontend connects before RTES has the token
      initialConnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && enabled) {
          connect();
        }
      }, INITIAL_CONNECTION_DELAY);
    } else {
      disconnect();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, executionId, connect, disconnect, cleanup]);

  return {
    status,
    connect,
    disconnect,
    isConnected: status === "connected",
    lastError,
  };
}

export default useRtesWebSocket;
