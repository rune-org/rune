import type { CheckedState } from "@radix-ui/react-checkbox";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  canChangeWorkflowStatus,
  canDeleteWorkflow,
  canExecuteWorkflow,
  canViewWorkflow,
} from "@/lib/permissions";
import type { WorkflowSummary } from "@/lib/workflows";
import type { ExecutionListItem as ApiExecutionListItem } from "@/client/types.gen";

export type StatFilter = "all" | "active" | "runs" | "draft" | "failed";

export function useWorkflowTableModel({
  workflows,
  isAdmin,
  lastRunByWorkflow,
  executionItems,
}: {
  workflows: WorkflowSummary[];
  isAdmin: boolean;
  lastRunByWorkflow: Map<string, ApiExecutionListItem>;
  executionItems: ApiExecutionListItem[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatFilter>("all");
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let list = workflows;

    switch (filter) {
      case "active":
        list = list.filter((workflow) => workflow.status === "active");
        break;
      case "draft":
        list = list.filter((workflow) => workflow.status === "draft");
        break;
      case "failed":
        list = list.filter((workflow) => lastRunByWorkflow.get(workflow.id)?.status === "failed");
        break;
      case "runs":
        list = list.filter((workflow) => lastRunByWorkflow.has(workflow.id));
        break;
      default:
        break;
    }

    if (!normalizedQuery) return list;
    return list.filter((workflow) => workflow.name.toLowerCase().includes(normalizedQuery));
  }, [filter, lastRunByWorkflow, query, workflows]);

  const filteredWorkflowIdSet = useMemo(() => new Set(filtered.map((workflow) => workflow.id)), [filtered]);

  useEffect(() => {
    setSelectedWorkflowIds((prev) => {
      const next = new Set([...prev].filter((id) => filteredWorkflowIdSet.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [filteredWorkflowIdSet]);

  const stats = useMemo(() => {
    const active = workflows.filter((workflow) => workflow.status === "active").length;
    const draft = workflows.filter((workflow) => workflow.status === "draft").length;
    const failed = workflows.filter(
      (workflow) => lastRunByWorkflow.get(workflow.id)?.status === "failed",
    ).length;
    const runs = executionItems.length;

    return { active, draft, failed, runs };
  }, [executionItems.length, lastRunByWorkflow, workflows]);

  const selectedWorkflows = useMemo(
    () => filtered.filter((workflow) => selectedWorkflowIds.has(workflow.id)),
    [filtered, selectedWorkflowIds],
  );

  const selectedCount = selectedWorkflows.length;
  const allFilteredSelected = filtered.length > 0 && selectedCount === filtered.length;
  const someFilteredSelected = selectedCount > 0 && selectedCount < filtered.length;

  const selectedRunnable = useMemo(
    () => selectedWorkflows.filter((workflow) => canExecuteWorkflow(workflow.role, isAdmin)),
    [isAdmin, selectedWorkflows],
  );
  const selectedActivatable = useMemo(
    () =>
      selectedWorkflows.filter(
        (workflow) =>
          workflow.status !== "active" && canChangeWorkflowStatus(workflow.role, isAdmin),
      ),
    [isAdmin, selectedWorkflows],
  );
  const selectedDeactivatable = useMemo(
    () =>
      selectedWorkflows.filter(
        (workflow) =>
          workflow.status === "active" && canChangeWorkflowStatus(workflow.role, isAdmin),
      ),
    [isAdmin, selectedWorkflows],
  );
  const selectedDeletable = useMemo(
    () => selectedWorkflows.filter((workflow) => canDeleteWorkflow(workflow.role, isAdmin)),
    [isAdmin, selectedWorkflows],
  );
  const selectedExportable = useMemo(
    () => selectedWorkflows.filter((workflow) => canViewWorkflow(workflow.role, isAdmin)),
    [isAdmin, selectedWorkflows],
  );

  const clearSelection = useCallback(() => {
    setSelectedWorkflowIds(new Set());
  }, []);

  const handleSelectAllFiltered = useCallback(
    (checked: CheckedState) => {
      if (checked === true) {
        setSelectedWorkflowIds(new Set(filtered.map((workflow) => workflow.id)));
        return;
      }
      setSelectedWorkflowIds(new Set());
    },
    [filtered],
  );

  const handleToggleSelected = useCallback((workflowId: string, checked: CheckedState) => {
    setSelectedWorkflowIds((prev) => {
      const next = new Set(prev);
      if (checked === true) next.add(workflowId);
      else next.delete(workflowId);
      return next;
    });
  }, []);

  return {
    query,
    setQuery,
    filter,
    setFilter,
    filtered,
    stats,
    selectedWorkflowIds,
    selectedCount,
    allFilteredSelected,
    someFilteredSelected,
    selectedRunnable,
    selectedActivatable,
    selectedDeactivatable,
    selectedDeletable,
    selectedExportable,
    clearSelection,
    handleSelectAllFiltered,
    handleToggleSelected,
    setSelectedWorkflowIds,
  };
}
