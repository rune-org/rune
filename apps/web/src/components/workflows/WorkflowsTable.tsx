"use client";

import type { CheckedState } from "@radix-ui/react-checkbox";
import { useCallback, useEffect, useMemo, useState } from "react";

import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import {
  bulkWorkflowOperation,
  deleteWorkflow,
  exportSingleWorkflowJson,
  exportWorkflowsZip,
  listUserExecutions,
  runWorkflow,
  updateWorkflowName,
  updateWorkflowStatus,
} from "@/lib/api/workflows";
import {
  canChangeWorkflowStatus,
  canDeleteWorkflow,
  canExecuteWorkflow,
  canViewWorkflow,
} from "@/lib/permissions";
import { useAppState } from "@/lib/state";
import type { WorkflowSummary } from "@/lib/workflows";
import type {
  BulkWorkflowAction,
  BulkWorkflowFailure,
  ExecutionListItem as ApiExecutionListItem,
} from "@/client/types.gen";
import { ShareWorkflowDialog } from "@/components/workflows/ShareWorkflowDialog";
import { WorkflowBulkActionsBar } from "@/components/workflows/table/WorkflowBulkActionsBar";
import { WorkflowsDialogs } from "@/components/workflows/table/WorkflowDialogs";
import { WorkflowsDataTable } from "@/components/workflows/table/WorkflowsDataTable";
import { WorkflowsTableFilters } from "@/components/workflows/table/WorkflowsTableFilters";
import type { StatFilter } from "@/components/workflows/table/workflowTableTypes";

const BULK_OPERATION_LIMIT = 100;

type BulkWorkflowResult = {
  succeededIds: number[];
  failed: BulkWorkflowFailure[];
  succeededCount: number;
  failedCount: number;
};

function downloadWorkflowFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function runWorkflowBulkOperation(
  action: BulkWorkflowAction,
  workflowIds: number[],
): Promise<BulkWorkflowResult> {
  if (workflowIds.length === 0) {
    return {
      succeededIds: [],
      failed: [],
      succeededCount: 0,
      failedCount: 0,
    };
  }

  const response = await bulkWorkflowOperation({
    action,
    workflow_ids: workflowIds,
  });

  if (response.error || !response.data?.data) {
    throw new Error(`Bulk ${action} failed`);
  }

  const result = response.data.data;
  return {
    succeededIds: result.succeeded,
    failed: result.failed,
    succeededCount: result.summary.succeeded,
    failedCount: result.summary.failed,
  };
}

function toNumericWorkflowIds(ids: string[]): number[] {
  return ids.map((id) => Number(id)).filter((id) => Number.isFinite(id));
}

export function WorkflowsTable() {
  const {
    state: { workflows, loading },
    actions,
  } = useAppState();

  const { state: authState } = useAuth();
  const isAdmin = authState.user?.role === "admin";

  // HACK: The /workflows endpoint doesn't expose execution history yet,
  // so we fetch from /executions (archivist) and join client-side.
  const [executionItems, setExecutionItems] = useState<ApiExecutionListItem[]>([]);
  const [executionsLoaded, setExecutionsLoaded] = useState(false);

  const [pendingWorkflowIds, setPendingWorkflowIds] = useState<Set<string>>(new Set());
  const [exportingWorkflowIds, setExportingWorkflowIds] = useState<Set<string>>(new Set());
  const [bulkActionPending, setBulkActionPending] = useState(false);
  const [renameTarget, setRenameTarget] = useState<WorkflowSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowSummary | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<WorkflowSummary | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatFilter>("all");
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Set<string>>(new Set());

  const refreshExecutions = useCallback(async () => {
    try {
      const response = await listUserExecutions();
      const items = response.data?.data;
      if (items) {
        setExecutionItems((prev) => {
          if (
            prev.length === items.length &&
            prev.every((item, index) => item.id === items[index].id)
          ) {
            return prev;
          }
          return items;
        });
      }
    } catch {
      // Keep table rendering resilient; show N/A when executions cannot be loaded.
    } finally {
      setExecutionsLoaded(true);
    }
  }, []);

  const lastRunByWorkflow = useMemo(() => {
    const map = new Map<string, ApiExecutionListItem>();
    for (const execution of executionItems) {
      const key = String(execution.workflow_id);
      const existing = map.get(key);
      if (!existing || execution.created_at > existing.created_at) {
        map.set(key, execution);
      }
    }
    return map;
  }, [executionItems]);

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

  const filteredWorkflowIdSet = useMemo(
    () => new Set(filtered.map((workflow) => workflow.id)),
    [filtered],
  );

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
        const selected = filtered.slice(0, BULK_OPERATION_LIMIT);
        setSelectedWorkflowIds(new Set(selected.map((workflow) => workflow.id)));
        if (filtered.length > BULK_OPERATION_LIMIT) {
          toast.info(
            `Bulk actions are limited to ${BULK_OPERATION_LIMIT} workflows. Selected the first ${BULK_OPERATION_LIMIT}.`,
          );
        }
        return;
      }
      setSelectedWorkflowIds(new Set());
    },
    [filtered],
  );

  const handleToggleSelected = useCallback((workflowId: string, checked: CheckedState) => {
    setSelectedWorkflowIds((prev) => {
      if (checked === true && !prev.has(workflowId) && prev.size >= BULK_OPERATION_LIMIT) {
        toast.error(`You can select up to ${BULK_OPERATION_LIMIT} workflows at once.`);
        return prev;
      }

      const next = new Set(prev);
      if (checked === true) next.add(workflowId);
      else next.delete(workflowId);
      return next;
    });
  }, []);

  const markWorkflowsPending = useCallback((ids: string[], pending: boolean) => {
    setPendingWorkflowIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (pending) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }, []);

  const markWorkflowsExporting = useCallback((ids: string[], exporting: boolean) => {
    setExportingWorkflowIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (exporting) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }, []);

  useEffect(() => {
    if (workflows.length === 0) void actions.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshExecutions();
  }, [refreshExecutions]);

  const handleToggleActive = useCallback(
    async (workflow: WorkflowSummary) => {
      const workflowId = Number(workflow.id);
      if (!Number.isFinite(workflowId)) return;

      markWorkflowsPending([workflow.id], true);
      try {
        await updateWorkflowStatus(workflowId, workflow.status !== "active");
        toast.success(workflow.status === "active" ? "Workflow deactivated" : "Workflow activated");
        await actions.refreshWorkflows();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update workflow status.");
      } finally {
        markWorkflowsPending([workflow.id], false);
      }
    },
    [actions, markWorkflowsPending],
  );

  const beginDelete = useCallback((workflow: WorkflowSummary) => {
    setDeleteTarget(workflow);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const workflowId = Number(deleteTarget.id);
    if (!Number.isFinite(workflowId)) {
      setDeleteTarget(null);
      return;
    }

    markWorkflowsPending([deleteTarget.id], true);
    try {
      await deleteWorkflow(workflowId);
      toast.success("Workflow deleted");
      setDeleteTarget(null);
      await actions.refreshWorkflows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete workflow.");
    } finally {
      markWorkflowsPending([deleteTarget.id], false);
    }
  }, [actions, deleteTarget, markWorkflowsPending]);

  const handleRun = useCallback(
    async (workflow: WorkflowSummary) => {
      const workflowId = Number(workflow.id);
      if (!Number.isFinite(workflowId)) return;

      markWorkflowsPending([workflow.id], true);
      try {
        await runWorkflow(workflowId);
        toast.success("Workflow successfully executed.");
        void refreshExecutions();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to queue workflow for execution.",
        );
      } finally {
        markWorkflowsPending([workflow.id], false);
      }
    },
    [markWorkflowsPending, refreshExecutions],
  );

  const handleExport = useCallback(
    async (workflow: WorkflowSummary, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      markWorkflowsExporting([workflow.id], true);
      try {
        const workflowId = Number(workflow.id);
        if (!Number.isFinite(workflowId)) {
          throw new Error("Invalid workflow ID");
        }
        // Single workflow export: download plain JSON file
        const { blob, fileName } = await exportSingleWorkflowJson(workflowId);
        downloadWorkflowFile(blob, fileName);
        if (!silent) toast.success("Workflow exported");
      } catch (error) {
        if (!silent) {
          toast.error(error instanceof Error ? error.message : "Failed to export workflow.");
        }
        throw error;
      } finally {
        markWorkflowsExporting([workflow.id], false);
      }
    },
    [markWorkflowsExporting],
  );

  const handleRenameSubmit = useCallback(
    async (newName: string) => {
      if (!renameTarget) return;
      const workflowId = Number(renameTarget.id);
      if (!Number.isFinite(workflowId)) return;

      const trimmed = newName.trim();
      if (!trimmed || trimmed === renameTarget.name) {
        setRenameTarget(null);
        return;
      }

      markWorkflowsPending([renameTarget.id], true);
      try {
        await updateWorkflowName(workflowId, trimmed);
        toast.success("Workflow renamed");
        setRenameTarget(null);
        await actions.refreshWorkflows();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to rename workflow.");
      } finally {
        markWorkflowsPending([renameTarget.id], false);
      }
    },
    [actions, markWorkflowsPending, renameTarget],
  );

  const handleBulkExport = useCallback(async () => {
    if (bulkActionPending || selectedCount === 0) return;

    const ids = [...selectedWorkflowIds];
    const workflowIds = toNumericWorkflowIds(ids);
    if (workflowIds.length === 0) return;
    if (workflowIds.length > BULK_OPERATION_LIMIT) {
      toast.error(`You can export up to ${BULK_OPERATION_LIMIT} workflows at once.`);
      return;
    }

    setBulkActionPending(true);
    markWorkflowsExporting(ids, true);
    try {
      // Route intelligently: single workflow → JSON, multiple → ZIP
      if (workflowIds.length === 1) {
        const { blob, fileName } = await exportSingleWorkflowJson(workflowIds[0]);
        downloadWorkflowFile(blob, fileName);
        toast.success("Workflow exported as JSON.");
      } else {
        const { blob, fileName } = await exportWorkflowsZip(workflowIds);
        downloadWorkflowFile(blob, fileName);
        toast.success(`Exported ${workflowIds.length} workflows.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk export failed");
    } finally {
      markWorkflowsExporting(ids, false);
      setBulkActionPending(false);
    }
  }, [bulkActionPending, markWorkflowsExporting, selectedCount, selectedWorkflowIds]);

  const handleBulkRun = useCallback(async () => {
    if (bulkActionPending || selectedCount === 0) return;

    const ids = [...selectedWorkflowIds];
    if (ids.length > BULK_OPERATION_LIMIT) {
      toast.error(`You can run up to ${BULK_OPERATION_LIMIT} workflows at once.`);
      return;
    }

    const runnableIds = new Set(selectedRunnable.map((workflow) => workflow.id));
    const runnableIdsSelected = ids.filter((id) => runnableIds.has(id));
    if (runnableIdsSelected.length === 0) return;

    setBulkActionPending(true);
    markWorkflowsPending(runnableIdsSelected, true);
    try {
      const workflowIds = toNumericWorkflowIds(runnableIdsSelected);
      const result = await runWorkflowBulkOperation("run", workflowIds);

      if (result.succeededCount > 0) {
        toast.success(
          `Queued ${result.succeededCount} workflow${result.succeededCount > 1 ? "s" : ""} for execution.`,
        );
        void refreshExecutions();
      }
      if (result.failedCount > 0) {
        toast.error(
          `Failed to run ${result.failedCount} workflow${result.failedCount > 1 ? "s" : ""}.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk run failed");
    } finally {
      markWorkflowsPending(runnableIdsSelected, false);
      setBulkActionPending(false);
    }
  }, [
    bulkActionPending,
    markWorkflowsPending,
    refreshExecutions,
    selectedCount,
    selectedRunnable,
    selectedWorkflowIds,
  ]);

  const handleBulkStatusChange = useCallback(
    async (target: "active" | "draft") => {
      if (bulkActionPending || selectedCount === 0) return;

      const ids = [...selectedWorkflowIds];
      if (ids.length > BULK_OPERATION_LIMIT) {
        toast.error(
          `You can ${target === "active" ? "activate" : "deactivate"} up to ${BULK_OPERATION_LIMIT} workflows at once.`,
        );
        return;
      }

      const candidates = target === "active" ? selectedActivatable : selectedDeactivatable;
      const candidateIds = new Set(candidates.map((workflow) => workflow.id));
      const candidateSelection = ids.filter((id) => candidateIds.has(id));
      if (candidateSelection.length === 0) return;

      setBulkActionPending(true);
      markWorkflowsPending(candidateSelection, true);
      try {
        const workflowIds = toNumericWorkflowIds(candidateSelection);
        const action = target === "active" ? "activate" : "deactivate";
        const result = await runWorkflowBulkOperation(action, workflowIds);

        if (result.succeededCount > 0) {
          toast.success(
            `${target === "active" ? "Activated" : "Deactivated"} ${result.succeededCount} workflow${result.succeededCount > 1 ? "s" : ""}.`,
          );
          await actions.refreshWorkflows();
        }
        if (result.failedCount > 0) {
          toast.error(
            `Failed to ${target === "active" ? "activate" : "deactivate"} ${result.failedCount} workflow${result.failedCount > 1 ? "s" : ""}.`,
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Bulk ${target === "active" ? "activate" : "deactivate"} failed`,
        );
      } finally {
        markWorkflowsPending(candidateSelection, false);
        setBulkActionPending(false);
      }
    },
    [
      actions,
      bulkActionPending,
      markWorkflowsPending,
      selectedCount,
      selectedActivatable,
      selectedDeactivatable,
      selectedWorkflowIds,
    ],
  );

  const handleBulkDelete = useCallback(async () => {
    if (bulkActionPending || selectedCount === 0) return;

    const ids = [...selectedWorkflowIds];
    if (ids.length > BULK_OPERATION_LIMIT) {
      toast.error(`You can delete up to ${BULK_OPERATION_LIMIT} workflows at once.`);
      return;
    }

    const deletableIds = new Set(selectedDeletable.map((workflow) => workflow.id));
    const deletableSelection = ids.filter((id) => deletableIds.has(id));
    if (deletableSelection.length === 0) return;

    setBulkActionPending(true);
    markWorkflowsPending(deletableSelection, true);
    try {
      const workflowIds = toNumericWorkflowIds(deletableSelection);
      const result = await runWorkflowBulkOperation("delete", workflowIds);

      if (result.succeededCount > 0) {
        toast.success(
          `Deleted ${result.succeededCount} workflow${result.succeededCount > 1 ? "s" : ""}.`,
        );
        setSelectedWorkflowIds((prev) => {
          const next = new Set(prev);
          result.succeededIds.forEach((id) => next.delete(String(id)));
          return next;
        });
        await actions.refreshWorkflows();
      }
      if (result.failedCount > 0) {
        toast.error(
          `Failed to delete ${result.failedCount} workflow${result.failedCount > 1 ? "s" : ""}.`,
        );
      }
      setBulkDeleteOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk delete failed");
    } finally {
      markWorkflowsPending(deletableSelection, false);
      setBulkActionPending(false);
    }
  }, [
    actions,
    bulkActionPending,
    markWorkflowsPending,
    selectedCount,
    selectedDeletable,
    selectedWorkflowIds,
  ]);

  const isRowPending = useCallback(
    (id: string) => pendingWorkflowIds.has(id),
    [pendingWorkflowIds],
  );
  const isRowExporting = useCallback(
    (id: string) => exportingWorkflowIds.has(id),
    [exportingWorkflowIds],
  );
  const hasPendingWorkflowOps = pendingWorkflowIds.size > 0;

  return (
    <div className="flex flex-col gap-4">
      <WorkflowsTableFilters
        stats={stats}
        filter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
      />

      <WorkflowBulkActionsBar
        selectedCount={selectedCount}
        runnableCount={selectedRunnable.length}
        activatableCount={selectedActivatable.length}
        deactivatableCount={selectedDeactivatable.length}
        exportableCount={selectedExportable.length}
        deletableCount={selectedDeletable.length}
        pending={bulkActionPending}
        onRun={handleBulkRun}
        onActivate={() => handleBulkStatusChange("active")}
        onDeactivate={() => handleBulkStatusChange("draft")}
        onExport={handleBulkExport}
        onDelete={() => setBulkDeleteOpen(true)}
        onClear={clearSelection}
      />

      <WorkflowsDataTable
        workflows={filtered}
        loading={loading}
        selectedWorkflowIds={selectedWorkflowIds}
        allFilteredSelected={allFilteredSelected}
        someFilteredSelected={someFilteredSelected}
        onSelectAllFiltered={handleSelectAllFiltered}
        onToggleSelected={handleToggleSelected}
        isRowPending={isRowPending}
        isRowExporting={isRowExporting}
        isAdmin={isAdmin}
        currentUserName={authState.user?.name ?? ""}
        lastRunByWorkflow={lastRunByWorkflow}
        executionsLoaded={executionsLoaded}
        onRun={handleRun}
        onExport={(workflow) => {
          void handleExport(workflow);
        }}
        onDelete={beginDelete}
        onRename={setRenameTarget}
        onToggleActive={(workflow) => {
          void handleToggleActive(workflow);
        }}
        onShare={setShareTarget}
      />

      <WorkflowsDialogs
        renameTarget={renameTarget}
        deleteTarget={deleteTarget}
        bulkDeleteOpen={bulkDeleteOpen}
        pending={hasPendingWorkflowOps}
        selectedCount={selectedCount}
        deletableCount={selectedDeletable.length}
        onRenameClose={() => setRenameTarget(null)}
        onRenameSubmit={handleRenameSubmit}
        onDeleteCancel={() => setDeleteTarget(null)}
        onDeleteConfirm={confirmDelete}
        onBulkDeleteCancel={() => setBulkDeleteOpen(false)}
        onBulkDeleteConfirm={handleBulkDelete}
      />

      {shareTarget && (
        <ShareWorkflowDialog
          workflowId={shareTarget.id}
          workflowName={shareTarget.name}
          open={shareTarget !== null}
          onOpenChange={(open) => {
            if (!open) setShareTarget(null);
          }}
        />
      )}
    </div>
  );
}
