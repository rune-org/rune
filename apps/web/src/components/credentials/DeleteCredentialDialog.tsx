"use client";

import { useState, useEffect } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { credentials as credentialsAPI } from "@/lib/api";
import { extractApiErrorMessage } from "@/lib/api/error";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { CredentialUsage } from "@/client";

interface DeleteCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentialId: number | null;
  credentialName: string;
  onConfirm: () => void;
}

export function DeleteCredentialDialog({
  open,
  onOpenChange,
  credentialId,
  credentialName,
  onConfirm,
}: DeleteCredentialDialogProps) {
  const [usage, setUsage] = useState<CredentialUsage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (open && credentialId) {
      const fetchUsage = async () => {
        try {
          setIsLoading(true);
          const response = await credentialsAPI.getCredentialUsage(credentialId);
          if (active && response.data && response.data.data) {
            setUsage(response.data.data);
          }
        } catch (err) {
          if (active) {
            const message = extractApiErrorMessage(err, "Failed to load credential usage");
            console.error(message, err);
          }
        } finally {
          if (active) setIsLoading(false);
        }
      };

      fetchUsage();
    } else {
      setUsage([]);
    }

    return () => {
      active = false;
    };
  }, [open, credentialId]);

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      isLoading={isLoading}
      title="Delete credential?"
      description={
        <div className="flex flex-col gap-4 pt-2 text-left">
          <div className="text-sm text-foreground">
            Are you sure you want to delete <strong>{credentialName}</strong>? This action cannot be
            undone.
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking workflow dependencies...
            </div>
          ) : usage.length > 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>Warning: Active Dependencies</span>
              </div>
              <div className="mt-2 text-sm opacity-90">
                This credential is used in <strong>{usage.length}</strong> workflow
                {usage.length === 1 ? "" : "s"}. Deleting it will cause these workflows to fail:
              </div>
              <div className="mt-3 max-h-[85px] overflow-y-auto rounded border border-destructive/10 bg-background/40 p-2 scrollbar-thin scrollbar-thumb-destructive/20">
                <ul className="list-inside list-disc text-xs space-y-1.5">
                  {usage.map((wf) => (
                    <li key={wf.id} className="truncate">
                      <span className="font-medium">{wf.name}</span>
                      <span className="ml-1 opacity-70 text-[10px]">({wf.owner_name})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">
              This credential is not currently referenced by any workflows.
            </div>
          )}
        </div>
      }
      cancelText="Cancel"
      confirmText={usage.length > 0 ? "Delete Anyway" : "Delete"}
      onConfirm={async () => {
        await onConfirm();
        return true;
      }}
      isDangerous
    />
  );
}
