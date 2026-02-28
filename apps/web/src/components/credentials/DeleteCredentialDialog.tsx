"use client";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface DeleteCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentialName: string;
  onConfirm: () => void;
}

export function DeleteCredentialDialog({
  open,
  onOpenChange,
  credentialName,
  onConfirm,
}: DeleteCredentialDialogProps) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete credential?"
      description={
        <>
          Are you sure you want to delete <strong>{credentialName}</strong>?
          This action cannot be undone, and any workflows using this
          credential may stop working.
        </>
      }
      cancelText="Cancel"
      confirmText="Delete"
      onConfirm={async () => {
        await onConfirm();
        return true;
      }}
      isDangerous
    />
  );
}
