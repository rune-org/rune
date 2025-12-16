"use client";

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  type ReactNode,
  type Dispatch,
} from "react";
import {
  type ExecutionState,
  type NodeExecutionData,
  type RtesNodeUpdate,
  type WorkflowExecutionStatus,
  initialExecutionState,
  rtesUpdateToNodeData,
  isCompletionMessage,
  parseWorkflowStatus,
} from "../types/execution";

// Action types for the reducer
type ExecutionAction =
  | { type: "START_EXECUTION"; executionId: string; workflowId: number }
  | { type: "NODE_UPDATE"; payload: RtesNodeUpdate }
  | { type: "BATCH_NODE_UPDATE"; payloads: RtesNodeUpdate[] }
  | {
      type: "WORKFLOW_COMPLETE";
      status: WorkflowExecutionStatus;
      totalDurationMs?: number;
    }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" }
  | { type: "LOAD_STATE"; state: ExecutionState };

/**
 * Reducer for execution state management.
 */
function executionReducer(
  state: ExecutionState,
  action: ExecutionAction
): ExecutionState {
  switch (action.type) {
    case "START_EXECUTION": {
      return {
        ...initialExecutionState,
        executionId: action.executionId,
        workflowId: action.workflowId,
        status: "running",
        startedAt: new Date().toISOString(),
        nodes: new Map(),
        isHistorical: false,
      };
    }

    case "NODE_UPDATE": {
      const { payload } = action;

      // Check if this is a workflow completion message
      if (isCompletionMessage(payload)) {
        return {
          ...state,
          status: parseWorkflowStatus(payload.status),
          completedAt: new Date().toISOString(),
        };
      }

      // Otherwise it's a node update
      const nodeData = rtesUpdateToNodeData(payload);
      if (!nodeData) return state;

      const newNodes = new Map(state.nodes);
      const existingNode = newNodes.get(nodeData.nodeId);

      // Merge with existing data (preserve previous input/output if not provided)
      newNodes.set(nodeData.nodeId, {
        ...existingNode,
        ...nodeData,
        input: nodeData.input ?? existingNode?.input,
        output: nodeData.output ?? existingNode?.output,
        parameters: nodeData.parameters ?? existingNode?.parameters,
        executedAt: new Date().toISOString(),
      });

      return {
        ...state,
        nodes: newNodes,
      };
    }

    case "BATCH_NODE_UPDATE": {
      const newNodes = new Map(state.nodes);
      let newStatus = state.status;
      let completedAt = state.completedAt;

      for (const payload of action.payloads) {
        if (isCompletionMessage(payload)) {
          newStatus = parseWorkflowStatus(payload.status);
          completedAt = new Date().toISOString();
          continue;
        }

        const nodeData = rtesUpdateToNodeData(payload);
        if (!nodeData) continue;

        const existingNode = newNodes.get(nodeData.nodeId);
        newNodes.set(nodeData.nodeId, {
          ...existingNode,
          ...nodeData,
          input: nodeData.input ?? existingNode?.input,
          output: nodeData.output ?? existingNode?.output,
          parameters: nodeData.parameters ?? existingNode?.parameters,
          executedAt: new Date().toISOString(),
        });
      }

      return {
        ...state,
        nodes: newNodes,
        status: newStatus,
        completedAt,
      };
    }

    case "WORKFLOW_COMPLETE": {
      return {
        ...state,
        status: action.status,
        totalDurationMs: action.totalDurationMs,
        completedAt: new Date().toISOString(),
      };
    }

    case "SET_ERROR": {
      return {
        ...state,
        status: "failed",
        error: action.error,
        completedAt: new Date().toISOString(),
      };
    }

    case "RESET": {
      return initialExecutionState;
    }

    case "LOAD_STATE": {
      return {
        ...action.state,
        isHistorical: true,
      };
    }

    default:
      return state;
  }
}

// Context type
interface ExecutionContextValue {
  state: ExecutionState;
  dispatch: Dispatch<ExecutionAction>;
  // Convenience methods
  getNodeExecution: (nodeId: string) => NodeExecutionData | undefined;
  isNodeRunning: (nodeId: string) => boolean;
  isNodeCompleted: (nodeId: string) => boolean;
  isNodeFailed: (nodeId: string) => boolean;
  isExecutionActive: boolean;
}

const ExecutionContext = createContext<ExecutionContextValue | null>(null);

/**
 * Provider component for execution state.
 */
export function ExecutionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(executionReducer, initialExecutionState);

  const getNodeExecution = useCallback(
    (nodeId: string) => state.nodes.get(nodeId),
    [state.nodes]
  );

  const isNodeRunning = useCallback(
    (nodeId: string) => state.nodes.get(nodeId)?.status === "running",
    [state.nodes]
  );

  const isNodeCompleted = useCallback(
    (nodeId: string) => state.nodes.get(nodeId)?.status === "success",
    [state.nodes]
  );

  const isNodeFailed = useCallback(
    (nodeId: string) => state.nodes.get(nodeId)?.status === "failed",
    [state.nodes]
  );

  const isExecutionActive = state.status === "running";

  const value = useMemo(
    () => ({
      state,
      dispatch,
      getNodeExecution,
      isNodeRunning,
      isNodeCompleted,
      isNodeFailed,
      isExecutionActive,
    }),
    [state, getNodeExecution, isNodeRunning, isNodeCompleted, isNodeFailed, isExecutionActive]
  );

  return (
    <ExecutionContext.Provider value={value}>
      {children}
    </ExecutionContext.Provider>
  );
}

/**
 * Hook to access execution context.
 * Throws if used outside of ExecutionProvider.
 */
export function useExecution(): ExecutionContextValue {
  const context = useContext(ExecutionContext);
  if (!context) {
    throw new Error("useExecution must be used within an ExecutionProvider");
  }
  return context;
}

/**
 * Hook to optionally access execution context.
 * Returns null if used outside of ExecutionProvider (no error thrown).
 */
export function useExecutionOptional(): ExecutionContextValue | null {
  return useContext(ExecutionContext);
}

/**
 * Hook to get execution data for a specific node.
 * Returns undefined if node has no execution data or if outside ExecutionProvider.
 */
export function useNodeExecution(nodeId: string): NodeExecutionData | undefined {
  const context = useContext(ExecutionContext);
  if (!context) return undefined;
  return context.getNodeExecution(nodeId);
}

/**
 * Hook to check if a node is currently running.
 * Returns false if outside ExecutionProvider.
 */
export function useIsNodeRunning(nodeId: string): boolean {
  const context = useContext(ExecutionContext);
  if (!context) return false;
  return context.isNodeRunning(nodeId);
}

export type { ExecutionAction };
