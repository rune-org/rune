"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { getExecutionHistory } from "../../canvas/stores/executionHistoryStore";
import type { ExecutionSnapshot } from "../../canvas/types/execution";
import type { ExecutionListItem, ExecutionMetrics, ExecutionFilters, ExecutionDetail } from "../types";

/**
 * Convert ExecutionSnapshot to ExecutionListItem for display.
 */
function snapshotToListItem(snapshot: ExecutionSnapshot): ExecutionListItem {
  const nodes = Object.values(snapshot.nodes);
  const successfulNodes = nodes.filter((n) => n.status === "success").length;
  const failedNodes = nodes.filter((n) => n.status === "failed").length;

  return {
    executionId: snapshot.executionId,
    workflowId: snapshot.workflowId,
    workflowName: snapshot.workflowName,
    status: snapshot.status,
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
    durationMs: snapshot.totalDurationMs,
    nodeCount: nodes.length,
    successfulNodes,
    failedNodes,
  };
}

/**
 * Convert ExecutionSnapshot to ExecutionDetail for detail view.
 */
function snapshotToDetail(snapshot: ExecutionSnapshot): ExecutionDetail {
  return {
    executionId: snapshot.executionId,
    workflowId: snapshot.workflowId,
    workflowName: snapshot.workflowName,
    status: snapshot.status,
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
    durationMs: snapshot.totalDurationMs,
    nodes: snapshot.nodes,
  };
}

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
 * TODO(fe): This currently uses localStorage, should be extended to fetch
 */
export function useExecutionsList(): UseExecutionsListReturn {
  const [rawSnapshots, setRawSnapshots] = useState<ExecutionSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ExecutionFilters>({ status: "all" });

  const loadExecutions = useCallback(() => {
    setIsLoading(true);
    try {
      const history = getExecutionHistory();
      setRawSnapshots(history);
    } catch (error) {
      console.error("Failed to load executions:", error);
      setRawSnapshots([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  const allExecutions = useMemo(
    () => rawSnapshots.map(snapshotToListItem),
    [rawSnapshots]
  );

  const executions = useMemo(
    () => applyFilters(allExecutions, filters),
    [allExecutions, filters]
  );

  const metrics = useMemo(() => calculateMetrics(allExecutions), [allExecutions]);

  const getExecutionDetail = useCallback(
    (executionId: string): ExecutionDetail | null => {
      const snapshot = rawSnapshots.find((s) => s.executionId === executionId);
      return snapshot ? snapshotToDetail(snapshot) : null;
    },
    [rawSnapshots]
  );

  const deleteExecution = useCallback(
    (executionId: string) => {
      import("../../canvas/stores/executionHistoryStore").then(({ deleteExecution: del }) => {
        del(executionId);
        loadExecutions();
      });
    },
    [loadExecutions]
  );

  const clearHistory = useCallback(() => {
    import("../../canvas/stores/executionHistoryStore").then(
      ({ clearExecutionHistory }) => {
        clearExecutionHistory();
        loadExecutions();
      }
    );
  }, [loadExecutions]);

  return {
    executions,
    allExecutions,
    metrics,
    isLoading,
    filters,
    setFilters,
    refresh: loadExecutions,
    getExecutionDetail,
    deleteExecution,
    clearHistory,
  };
}

export default useExecutionsList;
