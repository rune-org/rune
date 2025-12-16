/**
 * Execution history store for persisting and retrieving past execution states.
 * Uses localStorage for persistence across sessions.
 */

import {
  type ExecutionState,
  type ExecutionSnapshot,
  type NodeExecutionData,
  type WorkflowGraphSnapshot,
} from "../types/execution";

const STORAGE_KEY = "rune_execution_history";
const MAX_HISTORY_SIZE = 50; // Maximum number of executions to store

/**
 * Convert ExecutionState to a serializable ExecutionSnapshot.
 */
export function stateToSnapshot(
  state: ExecutionState,
  workflowName?: string,
  workflowGraph?: WorkflowGraphSnapshot
): ExecutionSnapshot | null {
  if (!state.executionId || !state.workflowId) return null;

  // Convert Map to plain object for JSON serialization
  const nodesRecord: Record<string, NodeExecutionData> = {};
  state.nodes.forEach((value, key) => {
    nodesRecord[key] = value;
  });

  return {
    executionId: state.executionId,
    workflowId: state.workflowId,
    status: state.status,
    nodes: nodesRecord,
    startedAt: state.startedAt ?? new Date().toISOString(),
    completedAt: state.completedAt,
    totalDurationMs: state.totalDurationMs,
    workflowName,
    workflowGraph,
  };
}

/**
 * Convert ExecutionSnapshot back to ExecutionState.
 */
export function snapshotToState(snapshot: ExecutionSnapshot): ExecutionState {
  // Convert plain object back to Map
  const nodesMap = new Map<string, NodeExecutionData>();
  Object.entries(snapshot.nodes).forEach(([key, value]) => {
    nodesMap.set(key, value);
  });

  return {
    executionId: snapshot.executionId,
    workflowId: snapshot.workflowId,
    status: snapshot.status,
    nodes: nodesMap,
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
    totalDurationMs: snapshot.totalDurationMs,
  };
}

/**
 * Get all execution snapshots from localStorage.
 */
export function getExecutionHistory(): ExecutionSnapshot[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed as ExecutionSnapshot[];
  } catch (error) {
    console.error("Failed to load execution history:", error);
    return [];
  }
}

/**
 * Get execution history filtered by workflow ID.
 */
export function getExecutionHistoryForWorkflow(
  workflowId: number
): ExecutionSnapshot[] {
  return getExecutionHistory().filter((s) => s.workflowId === workflowId);
}

/**
 * Get a specific execution snapshot by ID.
 */
export function getExecutionById(
  executionId: string
): ExecutionSnapshot | undefined {
  return getExecutionHistory().find((s) => s.executionId === executionId);
}

/**
 * Save an execution snapshot to history.
 */
export function saveExecutionSnapshot(snapshot: ExecutionSnapshot): void {
  if (typeof window === "undefined") return;

  try {
    const history = getExecutionHistory();

    // Remove existing entry with same executionId (update)
    const filtered = history.filter(
      (s) => s.executionId !== snapshot.executionId
    );

    // Add new snapshot at the beginning
    filtered.unshift(snapshot);

    // Trim to max size
    const trimmed = filtered.slice(0, MAX_HISTORY_SIZE);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to save execution snapshot:", error);
  }
}

/**
 * Save execution state to history.
 */
export function saveExecutionState(
  state: ExecutionState,
  workflowName?: string,
  workflowGraph?: WorkflowGraphSnapshot
): void {
  const snapshot = stateToSnapshot(state, workflowName, workflowGraph);
  if (snapshot) {
    saveExecutionSnapshot(snapshot);
  }
}

/**
 * Delete a specific execution from history.
 */
export function deleteExecution(executionId: string): void {
  if (typeof window === "undefined") return;

  try {
    const history = getExecutionHistory();
    const filtered = history.filter((s) => s.executionId !== executionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to delete execution:", error);
  }
}

/**
 * Clear all execution history.
 */
export function clearExecutionHistory(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear execution history:", error);
  }
}

/**
 * Clear history for a specific workflow.
 */
export function clearWorkflowHistory(workflowId: number): void {
  if (typeof window === "undefined") return;

  try {
    const history = getExecutionHistory();
    const filtered = history.filter((s) => s.workflowId !== workflowId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to clear workflow history:", error);
  }
}

/**
 * Get the most recent execution for a workflow.
 */
export function getLatestExecution(
  workflowId: number
): ExecutionSnapshot | undefined {
  const history = getExecutionHistoryForWorkflow(workflowId);
  return history[0]; // Already sorted by most recent
}

/**
 * Get count of executions in history.
 */
export function getHistoryCount(): number {
  return getExecutionHistory().length;
}

/**
 * Get count of executions for a workflow.
 */
export function getWorkflowHistoryCount(workflowId: number): number {
  return getExecutionHistoryForWorkflow(workflowId).length;
}
