/**
 * Execution tracking types for real-time workflow visualization.
 * These types map to the RTES WebSocket message formats.
 */

import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

// Node execution status
export type NodeExecutionStatus =
  | "idle"
  | "running"
  | "success"
  | "failed"
  | "waiting";

// Overall workflow execution status
export type WorkflowExecutionStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "halted";

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
export interface RtesNodeUpdate {
  node_id?: string | null;
  status?: string | null;
  input?: unknown;
  params?: unknown;
  output?: unknown;
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

  return {
    nodeId: update.node_id,
    status: parseNodeStatus(update.status),
    input: update.input,
    output: update.output,
    parameters: update.params,
    lineageHash: update.lineage_hash ?? undefined,
    branchId: update.branch_id ?? undefined,
    itemIndex: update.item_index ?? undefined,
    totalItems: update.total_items ?? undefined,
  };
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
};
