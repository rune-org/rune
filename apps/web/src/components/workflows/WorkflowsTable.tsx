"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import {
  deleteWorkflow,
  runWorkflow,
  updateWorkflowName,
  updateWorkflowStatus,
} from "@/lib/api/workflows";
import { useAppState } from "@/lib/state";
import type { WorkflowSummary } from "@/lib/workflows";
import { ShareWorkflowDialog } from "@/components/workflows/ShareWorkflowDialog";
import { WorkflowBulkActionsBar } from "@/components/workflows/table/WorkflowBulkActionsBar";
import { WorkflowsDataTable } from "@/components/workflows/table/WorkflowsDataTable";
import { WorkflowsTableFilters } from "@/components/workflows/table/WorkflowsTableFilters";
import {
  buildWorkflowExportFile,
  bulkExportWorkflowDetails,
  downloadWorkflowFile,
} from "@/components/workflows/table/workflowExport";
import { runWorkflowBulkOperation } from "@/components/workflows/table/workflowBulkOperations";
import { DeleteWorkflowDialog } from "@/components/workflows/table/dialogs/DeleteWorkflowDialog";
import { RenameWorkflowDialog } from "@/components/workflows/table/dialogs/RenameWorkflowDialog";
import { BulkDeleteWorkflowsDialog } from "@/components/workflows/table/dialogs/BulkDeleteWorkflowsDialog";
import { useWorkflowExecutionsLookup } from "@/components/workflows/table/hooks/useWorkflowExecutionsLookup";
import { useWorkflowTableModel } from "@/components/workflows/table/hooks/useWorkflowTableModel";

export function WorkflowsTable() {
  const {
    state: { workflows, loading },
    actions,
  } = useAppState();

  const { state: authState } = useAuth();
  const isAdmin = authState.user?.role === "admin";

  const { executionItems, executionsLoaded, lastRunByWorkflow, refreshExecutions } =
    useWorkflowExecutionsLookup();

  const [pendingWorkflowIds, setPendingWorkflowIds] = useState<Set<string>>(new Set());
  const [exportingWorkflowIds, setExportingWorkflowIds] = useState<Set<string>>(new Set());
  const [renameTarget, setRenameTarget] = useState<WorkflowSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowSummary | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<WorkflowSummary | null>(null);

  const {
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
  } = useWorkflowTableModel({
    workflows,
    isAdmin,
    lastRunByWorkflow,
    executionItems,
  });

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
        const result = await bulkExportWorkflowDetails([workflowId]);
        const detail = result.exported[0];
        if (!detail) {
          throw new Error("Workflow export was not returned by server");
        }
        const { blob, fileName } = buildWorkflowExportFile(workflow, detail);
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
    if (selectedExportable.length === 0) return;

    const selectedById = new Map(selectedExportable.map((workflow) => [Number(workflow.id), workflow]));
    const workflowIds = [...selectedById.keys()].filter(Number.isFinite);
    if (workflowIds.length === 0) return;

    markWorkflowsExporting(selectedExportable.map((workflow) => workflow.id), true);
    try {
      const result = await runWorkflowBulkOperation("export", workflowIds);

      for (const detail of result.exported) {
        const source = selectedById.get(detail.id);
        if (!source) continue;
        const { blob, fileName } = buildWorkflowExportFile(source, detail);
        downloadWorkflowFile(blob, fileName);
      }

      if (result.failedCount === 0) {
        toast.success(`Exported ${result.succeededCount} workflow${result.succeededCount === 1 ? "" : "s"}.`);
      } else {
        toast.error(
          `Exported ${result.succeededCount} and skipped ${result.failedCount} workflow${result.failedCount === 1 ? "" : "s"}.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk export failed");
    } finally {
      markWorkflowsExporting(selectedExportable.map((workflow) => workflow.id), false);
    }
  }, [markWorkflowsExporting, selectedExportable]);

  const handleBulkRun = useCallback(async () => {
    if (selectedRunnable.length === 0) return;

    const ids = selectedRunnable.map((workflow) => workflow.id);
    markWorkflowsPending(ids, true);
    try {
      const workflowIds = selectedRunnable
        .map((workflow) => Number(workflow.id))
        .filter((workflowId) => Number.isFinite(workflowId));
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
      markWorkflowsPending(ids, false);
    }
  }, [markWorkflowsPending, refreshExecutions, selectedRunnable]);

  const handleBulkStatusChange = useCallback(
    async (target: "active" | "draft") => {
      const candidates = target === "active" ? selectedActivatable : selectedDeactivatable;
      if (candidates.length === 0) return;

      const ids = candidates.map((workflow) => workflow.id);
      markWorkflowsPending(ids, true);
      try {
        const workflowIds = candidates
          .map((workflow) => Number(workflow.id))
          .filter((workflowId) => Number.isFinite(workflowId));
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
        markWorkflowsPending(ids, false);
      }
    },
    [actions, markWorkflowsPending, selectedActivatable, selectedDeactivatable],
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedDeletable.length === 0) return;

    const ids = selectedDeletable.map((workflow) => workflow.id);
    markWorkflowsPending(ids, true);
    try {
      const workflowIds = selectedDeletable
        .map((workflow) => Number(workflow.id))
        .filter((workflowId) => Number.isFinite(workflowId));
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
      markWorkflowsPending(ids, false);
    }
  }, [actions, markWorkflowsPending, selectedDeletable, setSelectedWorkflowIds]);

  const isRowPending = useCallback((id: string) => pendingWorkflowIds.has(id), [pendingWorkflowIds]);
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

      <RenameWorkflowDialog
        workflow={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
        pending={hasPendingWorkflowOps}
      />
      <DeleteWorkflowDialog
        workflow={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        pending={hasPendingWorkflowOps}
      />
      <BulkDeleteWorkflowsDialog
        open={bulkDeleteOpen}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        pending={hasPendingWorkflowOps}
        selectedCount={selectedCount}
        deletableCount={selectedDeletable.length}
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
