"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { plural } from "@/lib/plural";
import type { ScanResult } from "../lib/variableRefUpdate";

export type RenameChoice = "update" | "skip" | "cancel";

type RenameRefDialogProps = {
  open: boolean;
  oldName: string;
  newName: string;
  scanResult: ScanResult;
  onChoice: (choice: RenameChoice) => void;
};

export function RenameRefDialog({
  open,
  oldName,
  newName,
  scanResult,
  onChoice,
}: RenameRefDialogProps) {
  function handleOpenChange(isOpen: boolean): void {
    if (!isOpen) onChoice("cancel");
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Update variable references?</AlertDialogTitle>
          <AlertDialogDescription className="wrap-break-word">
            Renaming <strong className="break-all">{oldName}</strong> to{" "}
            <strong className="break-all">{newName}</strong> will affect{" "}
            <strong>{plural(scanResult.totalRefs, "reference")}</strong> in{" "}
            <strong>{plural(scanResult.affectedNodes.length, "node")}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row items-center gap-2 sm:justify-between">
          <AlertDialogCancel className="mt-0" onClick={() => onChoice("cancel")}>
            Cancel
          </AlertDialogCancel>
          <div className="flex items-center gap-2">
            <AlertDialogAction
              className="border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => onChoice("skip")}
            >
              Skip
            </AlertDialogAction>
            <AlertDialogAction onClick={() => onChoice("update")}>
              Update references
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
