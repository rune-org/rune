import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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

type RenameWorkflowDialogProps = {
  workflow: WorkflowSummary | null;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
  pending: boolean;
};

export function RenameWorkflowDialog({
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
              onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
              disabled={pending}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
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
