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

export type DeleteChoice = "delete" | "clear" | "cancel";

type DeleteRefDialogProps = {
  open: boolean;
  nodeNames: string[];
  scanResult: ScanResult;
  onChoice: (choice: DeleteChoice) => void;
};

const nameListFormat = new Intl.ListFormat("en", { type: "conjunction" });

export function DeleteRefDialog({ open, nodeNames, scanResult, onChoice }: DeleteRefDialogProps) {
  function handleOpenChange(isOpen: boolean): void {
    if (!isOpen) onChoice("cancel");
  }

  const nodeWord = nodeNames.length === 1 ? "node" : "nodes";

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete referenced {nodeWord}?</AlertDialogTitle>
          <AlertDialogDescription className="wrap-break-word">
            Deleting <strong className="break-all">{nameListFormat.format(nodeNames)}</strong> will
            leave <strong>{plural(scanResult.totalRefs, "stale reference")}</strong> in{" "}
            <strong>{plural(scanResult.affectedNodes.length, "other node")}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row items-center gap-2 sm:justify-between">
          <AlertDialogCancel className="mt-0" onClick={() => onChoice("cancel")}>
            Cancel
          </AlertDialogCancel>
          <div className="flex items-center gap-2">
            <AlertDialogAction
              className="border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => onChoice("delete")}
            >
              Delete anyway
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onChoice("clear")}
            >
              Delete and clear references
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
