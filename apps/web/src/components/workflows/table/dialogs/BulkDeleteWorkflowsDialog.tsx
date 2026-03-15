import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

type BulkDeleteWorkflowsDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  pending: boolean;
  selectedCount: number;
  deletableCount: number;
};

export function BulkDeleteWorkflowsDialog({
  open,
  onCancel,
  onConfirm,
  pending,
  selectedCount,
  deletableCount,
}: BulkDeleteWorkflowsDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onCancel();
      }}
      title="Delete selected workflows"
      description={
        <>
          This will permanently delete {deletableCount} workflow{deletableCount > 1 ? "s" : ""}.{" "}
          {selectedCount - deletableCount} selected workflow
          {selectedCount - deletableCount === 1 ? " is" : "s are"} skipped because you do not have
          delete permission. This action cannot be undone.
        </>
      }
      cancelText="Cancel"
      confirmText={pending ? "Deleting…" : "Delete Selected"}
      onConfirm={async () => {
        await onConfirm();
        return true;
      }}
      isDangerous
      isLoading={pending}
    />
  );
}
