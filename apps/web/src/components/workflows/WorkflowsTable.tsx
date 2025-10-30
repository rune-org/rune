"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MoreHorizontal, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppState } from "@/lib/state";
import type { WorkflowSummary } from "@/lib/workflows";
import { toast } from "@/components/ui/toast";
import {
  deleteWorkflow,
  runWorkflow,
  updateWorkflowName,
  updateWorkflowStatus,
} from "@/lib/api/workflows";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function timeAgo(iso: string | null): string {
  if (!iso) return "N/A";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / (1000 * 60 * 60));
  if (h < 1) {
    const m = Math.max(1, Math.floor(diff / (1000 * 60)));
    return `${m}m ago`;
  }
  return `${h}hr. ago`;
}

function StatusBadge({ status }: { status: WorkflowSummary["status"] }) {
  if (status === "active")
    return (
      <Badge className="bg-emerald-900/40 text-emerald-200" variant="secondary">
        Active
      </Badge>
    );
  return (
    <Badge className="bg-amber-900/40 text-amber-200" variant="secondary">
      Draft
    </Badge>
  );
}

type StatFilter = "all" | "active" | "runs" | "draft" | "failed";

export function WorkflowsTable() {
  const {
    state: { workflows, loading },
    actions,
  } = useAppState();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatFilter>("all");
  const [pendingWorkflowId, setPendingWorkflowId] = useState<string | null>(
    null,
  );
  const [renameTarget, setRenameTarget] = useState<WorkflowSummary | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<WorkflowSummary | null>(
    null,
  );

  useEffect(() => {
    if (workflows.length === 0) void actions.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleActive = useCallback(
    async (workflow: WorkflowSummary) => {
      const workflowId = Number(workflow.id);
      if (!Number.isFinite(workflowId)) return;

      setPendingWorkflowId(workflow.id);
      try {
        await updateWorkflowStatus(workflowId, workflow.status !== "active");
        toast.success(
          workflow.status === "active"
            ? "Workflow deactivated"
            : "Workflow activated",
        );
        await actions.refreshWorkflows();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update workflow status.",
        );
      } finally {
        setPendingWorkflowId(null);
      }
    },
    [actions],
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

    setPendingWorkflowId(deleteTarget.id);
    try {
      await deleteWorkflow(workflowId);
      toast.success("Workflow deleted");
      setDeleteTarget(null);
      await actions.refreshWorkflows();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete workflow.",
      );
    } finally {
      setPendingWorkflowId(null);
    }
  }, [actions, deleteTarget]);

  const handleRun = useCallback(async (workflow: WorkflowSummary) => {
    const workflowId = Number(workflow.id);
    if (!Number.isFinite(workflowId)) return;

    setPendingWorkflowId(workflow.id);
    try {
      await runWorkflow(workflowId);
      toast.info(
        "Workflow queued for execution. Monitoring will be available once the worker pipeline is connected.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to queue workflow for execution.",
      );
    } finally {
      setPendingWorkflowId(null);
    }
  }, []);

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

      setPendingWorkflowId(renameTarget.id);
      try {
        await updateWorkflowName(workflowId, trimmed);
        toast.success("Workflow renamed");
        setRenameTarget(null);
        await actions.refreshWorkflows();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to rename workflow.",
        );
      } finally {
        setPendingWorkflowId(null);
      }
    },
    [actions, renameTarget],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = workflows;
    switch (filter) {
      case "active":
        list = list.filter((w) => w.status === "active");
        break;
      case "draft":
        list = list.filter((w) => w.status === "draft");
        break;
      case "failed":
        list = list.filter((w) => w.lastRunStatus === "failed");
        break;
      case "runs":
        list = list.filter((w) => w.runs > 0);
        break;
      default:
        break;
    }
    if (!q) return list;
    return list.filter((w) => w.name.toLowerCase().includes(q));
  }, [workflows, query, filter]);

  const stats = useMemo(() => {
    const active = workflows.filter((w) => w.status === "active").length;
    const draft = workflows.filter((w) => w.status === "draft").length;
    const failed = workflows.filter((w) => w.lastRunStatus === "failed").length;
    const runs = workflows.reduce((sum, w) => sum + w.runs, 0);
    return { active, draft, failed, runs };
  }, [workflows]);

  const isRowPending = useCallback(
    (id: string) => pendingWorkflowId === id,
    [pendingWorkflowId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm">
          <button
            type="button"
            onClick={() =>
              setFilter((f) => (f === "active" ? "all" : "active"))
            }
            aria-pressed={filter === "active"}
            className={
              filter === "active"
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <span className="font-semibold">{stats.active}</span> Active
          </button>
          <button
            type="button"
            onClick={() => setFilter((f) => (f === "runs" ? "all" : "runs"))}
            aria-pressed={filter === "runs"}
            className={
              filter === "runs"
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <span className="font-semibold">{stats.runs}</span> Runs
          </button>
          <button
            type="button"
            onClick={() => setFilter((f) => (f === "draft" ? "all" : "draft"))}
            aria-pressed={filter === "draft"}
            className={
              filter === "draft"
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <span className="font-semibold">{stats.draft}</span> Draft
          </button>
          <button
            type="button"
            onClick={() =>
              setFilter((f) => (f === "failed" ? "all" : "failed"))
            }
            aria-pressed={filter === "failed"}
            className={
              filter === "failed"
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <span className="font-semibold">{stats.failed}</span> Failed
          </button>
        </div>
      </div>

      <div className="relative">
        <Input
          placeholder="Search workflows..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Name</TableHead>
            <TableHead className="w-[20%]">Trigger Type</TableHead>
            <TableHead className="w-[20%]">Status</TableHead>
            <TableHead className="w-[15%]">Last Run</TableHead>
            <TableHead className="w-[10%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((w) => (
            <TableRow
              key={w.id}
              data-loading={
                loading || isRowPending(w.id) ? "1" : undefined
              }
            >
              <TableCell className="font-medium text-foreground">
                <a
                  href={`/create/app?workflow=${w.id}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  {w.name}
                </a>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {w.triggerType}
              </TableCell>
              <TableCell>
                <StatusBadge status={w.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {timeAgo(w.lastRunAt)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={`Actions for ${w.name}`}
                      disabled={isRowPending(w.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <a href={`/create/app?workflow=${w.id}`}>
                        Open in Canvas
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setRenameTarget(w)}
                      disabled={isRowPending(w.id)}
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => handleToggleActive(w)}
                      disabled={isRowPending(w.id)}
                    >
                      {w.status === "active" ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => handleRun(w)}
                      disabled={isRowPending(w.id)}
                    >
                      Run
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => beginDelete(w)}
                      disabled={isRowPending(w.id)}
                      className="text-red-400 focus:text-red-300 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-200"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableCaption>
          {filtered.length === 0
            ? loading
              ? "Loading workflows..."
              : "No workflows found."
            : `${filtered.length} workflow${filtered.length > 1 ? "s" : ""} total.`}
        </TableCaption>
      </Table>
      <RenameWorkflowDialog
        workflow={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
        pending={pendingWorkflowId !== null}
      />
      <DeleteWorkflowDialog
        workflow={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        pending={pendingWorkflowId !== null}
      />
    </div>
  );
}

type RenameWorkflowDialogProps = {
  workflow: WorkflowSummary | null;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
  pending: boolean;
};

function RenameWorkflowDialog({
  workflow,
  onClose,
  onSubmit,
  pending,
}: RenameWorkflowDialogProps) {
  const [name, setName] = useState(workflow?.name ?? "");

  useEffect(() => {
    setName(workflow?.name ?? "");
  }, [workflow]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workflow || pending) return;
    await onSubmit(name);
  };

  return (
    <Dialog
      open={workflow !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename workflow</DialogTitle>
          <DialogDescription>
            Update the workflow name. This does not impact any executions.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="rename-workflow">Name</Label>
            <Input
              id="rename-workflow"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type DeleteWorkflowDialogProps = {
  workflow: WorkflowSummary | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  pending: boolean;
};

function DeleteWorkflowDialog({
  workflow,
  onCancel,
  onConfirm,
  pending,
}: DeleteWorkflowDialogProps) {
  return (
    <Dialog
      open={workflow !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete workflow</DialogTitle>
          <DialogDescription>
            This will permanently delete the workflow{" "}
            <span className="font-semibold">
              {workflow?.name ?? "Untitled"}
            </span>{" "}
            and its configuration. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            type="button"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            type="button"
            onClick={() => {
              if (!pending) void onConfirm();
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
