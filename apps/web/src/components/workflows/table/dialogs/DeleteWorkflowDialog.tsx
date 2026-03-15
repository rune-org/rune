import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { WorkflowSummary } from "@/lib/workflows";

type DeleteWorkflowDialogProps = {
  workflow: WorkflowSummary | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  pending: boolean;
};

export function DeleteWorkflowDialog({
  workflow,
  onCancel,
  onConfirm,
  pending,
}: DeleteWorkflowDialogProps) {
  return (
    <ConfirmationDialog
      open={workflow !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
      title="Delete workflow"
      description={
        <>
          This will permanently delete the workflow{" "}
          <span className="font-semibold">{workflow?.name ?? "Untitled"}</span> and its
          configuration. This action cannot be undone.
        </>
      }
      cancelText="Cancel"
      confirmText={pending ? "Deleting…" : "Delete"}
      onConfirm={async () => {
        await onConfirm();
        return true;
      }}
      isDangerous
      isLoading={pending}
    />
  );
}
