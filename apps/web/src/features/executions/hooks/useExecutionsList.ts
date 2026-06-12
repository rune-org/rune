"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { listUserExecutions } from "@/lib/api/workflows";
import type { ExecutionListItem as ApiExecutionListItem, ExecutionStatus } from "@/client/types.gen";
import type { ExecutionListItem, ExecutionMetrics, ExecutionFilters } from "../types";

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
    durationsMs.length > 0 ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length : 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const executionsToday = executions.filter((e) => new Date(e.startedAt) >= todayStart).length;
  const executionsThisWeek = executions.filter((e) => new Date(e.startedAt) >= weekStart).length;

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


export interface UseExecutionsListReturn {
  /** List of executions (paginated) */
  executions: ExecutionListItem[];
  /** Raw unfiltered executions */
  allExecutions: ExecutionListItem[];
  /** Calculated metrics */
  metrics: ExecutionMetrics;
  /** Loading state */
  isLoading: boolean;
  /** Current page */
  page: number;
  /** Set page */
  setPage: (page: number) => void;
  /** Page size */
  pageSize: number;
  /** Set page size */
  setPageSize: (pageSize: number) => void;
  /** Search query */
  search: string;
  /** Set search query */
  setSearch: (search: string) => void;
  /** Total executions */
  total: number;
  /** Total pages */
  totalPages: number;
  /** Current filters */
  filters: ExecutionFilters;
  /** Set filters */
  setFilters: (filters: ExecutionFilters) => void;
  /** Refresh the list */
  refresh: () => void;
}

/**
 * Hook for listing all executions across workflows.
 */
export function useExecutionsList(): UseExecutionsListReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<ExecutionFilters>({ status: "all" });
  const [allExecutions, setAllExecutions] = useState<ExecutionListItem[]>([]);
  const [paginatedExecutions, setPaginatedExecutions] = useState<ExecutionListItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const metrics = useMemo(() => calculateMetrics(allExecutions), [allExecutions]);

  const loadMetrics = useCallback(async () => {
    try {
      const response = await listUserExecutions();
      if (response.data?.data) {
        const items = response.data.data;
        const mapped = Array.isArray(items) ? items.map(mapExecution) : (items.items ?? []).map(mapExecution);
        setAllExecutions(mapped);
      }
    } catch (error) {
      console.error("[useExecutionsList] Failed to load metrics", error);
    }
  }, []);

  const loadPaginated = useCallback(async (
    currentPage: number,
    currentPageSize: number,
    currentSearch: string,
    currentFilters: ExecutionFilters,
  ) => {
    const statusParam = currentFilters.status && currentFilters.status !== "all" ? (currentFilters.status as ExecutionStatus) : undefined;
    const params: NonNullable<Parameters<typeof listUserExecutions>[0]> = {
      page: currentPage,
      page_size: currentPageSize,
      search: currentSearch.trim() || undefined,
      status: statusParam,
    };

    const response = await listUserExecutions(params);
    if (response.error) {
      throw response.error;
    }

    const resData = response.data?.data;
    if (resData && !Array.isArray(resData)) {
      setPaginatedExecutions((resData.items ?? []).map(mapExecution));
      setTotal(resData.total ?? 0);
      setTotalPages(resData.total_pages ?? 1);
    } else if (Array.isArray(resData)) {
      setPaginatedExecutions(resData.map(mapExecution));
      setTotal(resData.length);
      setTotalPages(1);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadPaginated(page, pageSize, search, filters),
        loadMetrics(),
      ]);
    } catch (error) {
      console.error("[useExecutionsList] Failed to fetch executions", error);
      toast.error("Failed to load executions");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, filters, loadPaginated, loadMetrics]);

  // Load metrics once on mount
  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  // Load paginated data on changes
  useEffect(() => {
    setIsLoading(true);
    loadPaginated(page, pageSize, search, filters)
      .catch((error) => {
        console.error("[useExecutionsList] Failed to fetch executions", error);
        toast.error("Failed to load executions");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [page, pageSize, search, filters, loadPaginated]);

  return {
    executions: paginatedExecutions,
    allExecutions,
    metrics,
    isLoading,
    page,
    setPage,
    pageSize,
    setPageSize,
    search,
    setSearch,
    total,
    totalPages,
    filters,
    setFilters,
    refresh,
  };
}

export default useExecutionsList;
