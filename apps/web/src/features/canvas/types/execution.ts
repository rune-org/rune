/**
 * Execution tracking types for real-time workflow visualization.
 * These types map to the RTES WebSocket message formats.
 */

import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

// Node execution status
export type NodeExecutionStatus = "idle" | "running" | "success" | "failed" | "waiting";

// Overall workflow execution status
export type WorkflowExecutionStatus = "idle" | "running" | "completed" | "failed" | "halted";

// Error structure from RTES
export interface NodeError {
  message: string;
  code?: string;
  details?: unknown;
}

// Execution data for a single node
export interface NodeExecutionData {
  nodeId: string;
  status: NodeExecutionStatus;
  input?: unknown;
  output?: unknown;
  parameters?: unknown;
  error?: NodeError;
  executedAt?: string;
  durationMs?: number;
  // For split node support (TODO(ash): remember this)
  lineageHash?: string;
  lineageStack?: RtesStackFrame[];
  splitNodeId?: string;
  branchId?: string;
  itemIndex?: number;
  totalItems?: number;
}

// Overall execution state
export interface ExecutionState {
  executionId: string | null;
  workflowId: number | null;
  status: WorkflowExecutionStatus;
  nodes: Map<string, NodeExecutionData>;
  nodeExecutions: Map<string, NodeExecutionData[]>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  totalDurationMs?: number;
  /** True when viewing a historical execution (should not re-save) */
  isHistorical?: boolean;
  /** Snapshot of the workflow graph at the time of execution */
  graphSnapshot?: WorkflowGraphSnapshot;
}

export interface WorkflowGraphSnapshot {
  nodes: CanvasNode[];
  edges: Edge[];
}

// TODO(rtes): Should be fetched from RTES API
export interface ExecutionSnapshot {
  executionId: string;
  workflowId: number;
  status: WorkflowExecutionStatus;
  nodes: Record<string, NodeExecutionData>; // Serializable version
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  workflowName?: string;
}

/**
 * RTES WebSocket message types.
 * These match the WsNodeUpdateDto from services/rtes/src/api/ws.rs
 */
export interface RtesNodeError {
  message: string;
  code: string;
  details?: unknown;
}

export interface RtesNodeUpdate {
  node_id?: string | null;
  status?: string | null;
  input?: unknown;
  params?: unknown;
  output?: unknown;
  error?: RtesNodeError | null;
  lineage_hash?: string | null;
  lineage_stack?: RtesStackFrame[] | null;
  split_node_id?: string | null;
  branch_id?: string | null;
  item_index?: number | null;
  total_items?: number | null;
  processed_count?: number | null;
  aggregator_state?: string | null;
  used_inputs?: unknown;
}

// Stack frame for split node lineage tracking
export interface RtesStackFrame {
  split_node_id: string;
  branch_id: string;
  item_index: number;
  total_items: number;
}

/**
 * Convert RTES status string to our typed status.
 */
export function parseNodeStatus(status: string | null | undefined): NodeExecutionStatus {
  if (!status) return "idle";

  switch (status.toLowerCase()) {
    case "running":
      return "running";
    case "success":
    case "completed":
      return "success";
    case "failed":
    case "error":
      return "failed";
    case "waiting":
    case "pending":
      return "waiting";
    default:
      return "idle";
  }
}

/**
 * Convert RTES workflow status to our typed status.
 */
export function parseWorkflowStatus(status: string | null | undefined): WorkflowExecutionStatus {
  if (!status) return "idle";

  switch (status.toLowerCase()) {
    case "running":
      return "running";
    case "completed":
    case "success":
      return "completed";
    case "failed":
    case "error":
      return "failed";
    case "halted":
    case "stopped":
      return "halted";
    default:
      return "idle";
  }
}

/**
 * Convert RtesNodeUpdate to NodeExecutionData.
 */
export function rtesUpdateToNodeData(update: RtesNodeUpdate): NodeExecutionData | null {
  if (!update.node_id) return null;

  const latestLineageFrame =
    update.lineage_stack && update.lineage_stack.length > 0
      ? update.lineage_stack[update.lineage_stack.length - 1]
      : undefined;

  return {
    nodeId: update.node_id,
    status: parseNodeStatus(update.status),
    input: update.input,
    output: update.output,
    parameters: update.params,
    error: update.error
      ? { message: update.error.message, code: update.error.code, details: update.error.details }
      : undefined,
    lineageHash: update.lineage_hash ?? undefined,
    lineageStack: update.lineage_stack ?? undefined,
    splitNodeId: update.split_node_id ?? latestLineageFrame?.split_node_id,
    branchId: update.branch_id ?? latestLineageFrame?.branch_id,
    itemIndex: update.item_index ?? latestLineageFrame?.item_index,
    totalItems: update.total_items ?? latestLineageFrame?.total_items,
  };
}

export function nodeExecutionInstanceKey(execution: NodeExecutionData): string {
  if (execution.lineageStack && execution.lineageStack.length > 0) {
    return `stack:${execution.lineageStack
      .map((frame) => `${frame.split_node_id}:${frame.item_index}`)
      .join("/")}`;
  }
  if (execution.splitNodeId && execution.itemIndex !== undefined) {
    return `split:${execution.splitNodeId}:item:${execution.itemIndex}`;
  }
  if (execution.branchId && execution.itemIndex !== undefined) {
    return `branch:${execution.branchId}:item:${execution.itemIndex}`;
  }
  if (execution.lineageHash) return `lineage:${execution.lineageHash}`;
  if (execution.branchId) return `branch:${execution.branchId}`;
  if (execution.itemIndex !== undefined) return `item:${execution.itemIndex}`;
  return "default";
}

export function isSameNodeExecutionInstance(a: NodeExecutionData, b: NodeExecutionData): boolean {
  if (a.nodeId !== b.nodeId) return false;
  if (nodeExecutionInstanceKey(a) === nodeExecutionInstanceKey(b)) return true;
  if (a.itemIndex === undefined || b.itemIndex === undefined) return false;
  if (a.itemIndex !== b.itemIndex) return false;
  if (a.totalItems !== undefined && b.totalItems !== undefined && a.totalItems !== b.totalItems) {
    return false;
  }
  if (a.splitNodeId && b.splitNodeId && a.splitNodeId !== b.splitNodeId) return false;

  return true;
}

/**
 * Check if an RTES message is a workflow completion message.
 * Completion messages have no node_id but have a status.
 */
export function isCompletionMessage(update: RtesNodeUpdate): boolean {
  return !update.node_id && !!update.status;
}

/**
 * Initial execution state.
 */
export const initialExecutionState: ExecutionState = {
  executionId: null,
  workflowId: null,
  status: "idle",
  nodes: new Map(),
  nodeExecutions: new Map(),
};
