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
import { AlertTriangle } from "lucide-react";

interface VersionConflictDialogProps {
  open: boolean;
  serverVersion: number;
  serverVersionId: number;
  onLoadServer: () => void;
  onForceSave: () => void;
  onCancel: () => void;
}

export function VersionConflictDialog({
  open,
  serverVersion,
  serverVersionId,
  onLoadServer,
  onForceSave,
  onCancel,
}: VersionConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Version conflict
          </DialogTitle>
          <DialogDescription>
            Someone saved a newer version (v{serverVersion}) while you were
            editing. Choose how to proceed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 text-sm">
          <Button variant="outline" className="justify-start" onClick={onLoadServer}>
            Load their version (v{serverVersion}) and discard your changes
          </Button>
          <Button variant="outline" className="justify-start" onClick={onForceSave}>
            Save your changes as a new version on top of v{serverVersion}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
