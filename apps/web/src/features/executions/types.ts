/**
 * Types for the Executions page.
 * These extend the canvas execution types for list views.
 */

import type { WorkflowExecutionStatus, NodeExecutionData } from "../canvas/types/execution";

/**
 * Execution list item for display in the table.
 */
export interface ExecutionListItem {
  executionId: string;
  workflowId: number;
  workflowName?: string;
  status: WorkflowExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  nodeCount: number;
  successfulNodes: number;
  failedNodes: number;
}

/**
 * Execution detail view data.
 */
export interface ExecutionDetail {
  executionId: string;
  workflowId: number;
  workflowName?: string;
  status: WorkflowExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  nodes: Record<string, NodeExecutionData>;
  error?: string;
}

/**
 * Metrics for the executions dashboard.
 */
export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDurationMs: number;
  executionsToday: number;
  executionsThisWeek: number;
}

/**
 * Filter options for the executions list.
 */
export interface ExecutionFilters {
  workflowId?: number;
  status?: WorkflowExecutionStatus | "all";
  dateRange?: {
    start: Date;
    end: Date;
  };
}
