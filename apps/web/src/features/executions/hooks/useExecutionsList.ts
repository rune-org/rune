"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { listUserExecutions } from "@/lib/api/workflows";
import type { ExecutionListItem as ApiExecutionListItem } from "@/client/types.gen";
import type {
  ExecutionListItem,
  ExecutionMetrics,
  ExecutionFilters,
  ExecutionDetail,
} from "../types";

function mapExecution(item: ApiExecutionListItem): ExecutionListItem {
  return {
    executionId: item.id,
    workflowId: item.workflow_id,
    workflowName: item.workflow_name,
    status: item.status,
    startedAt: item.created_at,
    completedAt: item.completed_at ?? undefined,
    durationMs: item.total_duration_ms ?? undefined,
    failureReason: item.failure_reason ?? undefined,
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
}

/**
 * Hook for listing all executions across workflows.
 */
export function useExecutionsList(): UseExecutionsListReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<ExecutionFilters>({ status: "all" });
  const [allExecutions, setAllExecutions] = useState<ExecutionListItem[]>([]);

  const executions = useMemo(
    () => applyFilters(allExecutions, filters),
    [allExecutions, filters]
  );

  const metrics = useMemo(() => calculateMetrics(allExecutions), [allExecutions]);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await listUserExecutions();

      if (response.error) {
        throw response.error;
      }

      const items = response.data?.data ?? [];
      setAllExecutions(items.map(mapExecution));
    } catch (error) {
      console.error("[useExecutionsList] Failed to fetch executions", error);
      toast.error("Failed to load executions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getExecutionDetail = useCallback(
    (executionId: string): ExecutionDetail | null => {
      const execution = allExecutions.find((item) => item.executionId === executionId);

      if (!execution) {
        return null;
      }

      return {
        executionId: execution.executionId,
        workflowId: execution.workflowId,
        workflowName: execution.workflowName,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        durationMs: execution.durationMs,
        nodes: {},
        error: execution.failureReason,
      };
    },
    [allExecutions]
  );

  return {
    executions,
    allExecutions,
    metrics,
    isLoading,
    filters,
    setFilters,
    refresh,
    getExecutionDetail,
  };
}

export default useExecutionsList;
