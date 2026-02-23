"use client";

import { useState, useMemo, useCallback } from "react";
import type { ExecutionListItem, ExecutionMetrics, ExecutionFilters, ExecutionDetail } from "../types";

/**
 * Calculate metrics from execution history.
 */
function calculateMetrics(executions: ExecutionListItem[]): ExecutionMetrics {
  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter((e) => e.status === "completed").length;
  const failedExecutions = executions.filter((e) => e.status === "failed").length;
  const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

  const durationsMs = executions
    .filter((e) => e.durationMs !== undefined)
    .map((e) => e.durationMs as number);
  const averageDurationMs =
    durationsMs.length > 0
      ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length
      : 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const executionsToday = executions.filter(
    (e) => new Date(e.startedAt) >= todayStart
  ).length;
  const executionsThisWeek = executions.filter(
    (e) => new Date(e.startedAt) >= weekStart
  ).length;

  return {
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    successRate,
    averageDurationMs,
    executionsToday,
    executionsThisWeek,
  };
}

/**
 * Apply filters to execution list.
 */
function applyFilters(
  executions: ExecutionListItem[],
  filters: ExecutionFilters
): ExecutionListItem[] {
  let filtered = executions;

  if (filters.workflowId !== undefined) {
    filtered = filtered.filter((e) => e.workflowId === filters.workflowId);
  }

  if (filters.status && filters.status !== "all") {
    filtered = filtered.filter((e) => e.status === filters.status);
  }

  if (filters.dateRange) {
    const { start, end } = filters.dateRange;
    filtered = filtered.filter((e) => {
      const date = new Date(e.startedAt);
      return date >= start && date <= end;
    });
  }

  return filtered;
}

export interface UseExecutionsListReturn {
  /** List of executions (filtered) */
  executions: ExecutionListItem[];
  /** Raw unfiltered executions */
  allExecutions: ExecutionListItem[];
  /** Calculated metrics */
  metrics: ExecutionMetrics;
  /** Loading state */
  isLoading: boolean;
  /** Current filters */
  filters: ExecutionFilters;
  /** Set filters */
  setFilters: (filters: ExecutionFilters) => void;
  /** Refresh the list */
  refresh: () => void;
  /** Get execution detail by ID */
  getExecutionDetail: (executionId: string) => ExecutionDetail | null;
  /** Delete an execution from history */
  deleteExecution: (executionId: string) => void;
  /** Clear all execution history */
  clearHistory: () => void;
}

/**
 * Hook for listing all executions across workflows.
 *
 * TODO(rtes): This hook needs a new RTES endpoint to fetch all executions.
 * Currently returns empty data. The per-workflow execution history is
 * available via ExecutionHistoryPanel which uses RTES.
 *
 * Required RTES endpoint: GET /executions (with optional filters)
 */
export function useExecutionsList(): UseExecutionsListReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<ExecutionFilters>({ status: "all" });

  // TODO(rtes): Implement fetching all executions from RTES
  // This requires a new endpoint: GET /executions
  const allExecutions: ExecutionListItem[] = useMemo(() => [], []);

  const executions = useMemo(
    () => applyFilters(allExecutions, filters),
    [allExecutions, filters]
  );

  const metrics = useMemo(() => calculateMetrics(allExecutions), [allExecutions]);

  const refresh = useCallback(() => {
    // TODO(rtes): Implement refresh from RTES
    console.warn("[useExecutionsList] RTES endpoint not implemented yet");
  }, []);

  const getExecutionDetail = useCallback(
    (_executionId: string): ExecutionDetail | null => {
      // TODO(rtes): Fetch from RTES using fetchExecution()
      return null;
    },
    []
  );

  const deleteExecution = useCallback((_executionId: string) => {
    // TODO(rtes): Implement delete endpoint in RTES
    console.warn("[useExecutionsList] Delete not implemented in RTES");
  }, []);

  const clearHistory = useCallback(() => {
    // TODO(rtes): Implement clear endpoint in RTES
    console.warn("[useExecutionsList] Clear not implemented in RTES");
  }, []);

  return {
    executions,
    allExecutions,
    metrics,
    isLoading,
    filters,
    setFilters,
    refresh,
    getExecutionDetail,
    deleteExecution,
    clearHistory,
  };
}

export default useExecutionsList;
