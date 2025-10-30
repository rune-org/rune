"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete credential?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{credentialName}</strong>?
            This action cannot be undone, and any workflows using this
            credential may stop working.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
