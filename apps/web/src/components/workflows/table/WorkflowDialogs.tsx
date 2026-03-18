import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkflowSummary } from "@/lib/workflows";

type WorkflowsDialogsProps = {
  renameTarget: WorkflowSummary | null;
  deleteTarget: WorkflowSummary | null;
  bulkDeleteOpen: boolean;
  pending: boolean;
  selectedCount: number;
  deletableCount: number;
  onRenameClose: () => void;
  onRenameSubmit: (name: string) => void | Promise<void>;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void | Promise<void>;
  onBulkDeleteCancel: () => void;
  onBulkDeleteConfirm: () => void | Promise<void>;
};

export function WorkflowsDialogs({
  renameTarget,
  deleteTarget,
  bulkDeleteOpen,
  pending,
  selectedCount,
  deletableCount,
  onRenameClose,
  onRenameSubmit,
  onDeleteCancel,
  onDeleteConfirm,
  onBulkDeleteCancel,
  onBulkDeleteConfirm,
}: WorkflowsDialogsProps) {
  const [name, setName] = useState(renameTarget?.name ?? "");

  useEffect(() => {
    setName(renameTarget?.name ?? "");
  }, [renameTarget]);

  const handleRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameTarget || pending) return;
    await onRenameSubmit(name);
  };

  return (
    <>
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open && !pending) onRenameClose();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename workflow</DialogTitle>
            <DialogDescription>
              Update the workflow name. This does not impact any executions.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleRenameSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="rename-workflow">Name</Label>
              <Input
                id="rename-workflow"
                value={name}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                disabled={pending}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onRenameClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !pending) onDeleteCancel();
        }}
        title="Delete workflow"
        description={
          <>
            This will permanently delete the workflow{" "}
            <span className="font-semibold">{deleteTarget?.name ?? "Untitled"}</span> and its
            configuration. This action cannot be undone.
          </>
        }
        cancelText="Cancel"
        confirmText={pending ? "Deleting..." : "Delete"}
        onConfirm={async () => {
          await onDeleteConfirm();
          return true;
        }}
        isDangerous
        isLoading={pending}
      />

      <ConfirmationDialog
        open={bulkDeleteOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !pending) onBulkDeleteCancel();
        }}
        title="Delete selected workflows"
        description={
          <>
            This will permanently delete {deletableCount} workflow{deletableCount > 1 ? "s" : ""}.{" "}
            {selectedCount - deletableCount > 0 && (
              <>
                {selectedCount - deletableCount} selected workflow
                {selectedCount - deletableCount === 1 ? " is" : "s are"} skipped because you do not
                have delete permission.{" "}
              </>
            )}
            This action cannot be undone.
          </>
        }
        cancelText="Cancel"
        confirmText={pending ? "Deleting..." : "Delete Selected"}
        onConfirm={async () => {
          await onBulkDeleteConfirm();
          return true;
        }}
        isDangerous
        isLoading={pending}
      />
    </>
  );
}
