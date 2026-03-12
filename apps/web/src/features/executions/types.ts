/**
 * Types for the Executions page.
 */

import type { ExecutionStatus } from "@/client/types.gen";
import type { NodeExecutionData } from "../canvas/types/execution";

export type ExecutionListStatus = ExecutionStatus;

/**
 * Execution list item for display in the table.
 */
export interface ExecutionListItem {
  executionId: string;
  workflowId: number;
  workflowName?: string;
  status: ExecutionListStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  failureReason?: string;
}

/**
 * Execution detail view data.
 */
export interface ExecutionDetail {
  executionId: string;
  workflowId: number;
  workflowName?: string;
  status: ExecutionListStatus;
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
  status?: ExecutionListStatus | "all";
  dateRange?: {
    start: Date;
    end: Date;
  };
}
