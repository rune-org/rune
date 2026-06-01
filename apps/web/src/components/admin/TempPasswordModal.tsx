"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface TempPasswordModalProps {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
}

export function TempPasswordModal({ open, onClose, email, password }: TempPasswordModalProps) {
  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied to clipboard");
    } catch (err) {
      console.error("Clipboard copy failed", err);
      toast.error("Failed to copy password");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        hideCloseButton
        closeOnOutsideClick={false}
        closeOnEscape={false}
        className="max-w-md gap-4"
      >
        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="text-lg">Invitation created</DialogTitle>
          <DialogDescription>
            Share the temporary password with the new user so they can sign in and change it.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-4 bg-muted rounded">
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="font-medium">{email}</div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Temporary password</div>
              <div className="font-mono font-medium text-lg">{password}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center gap-2">
          <Button variant="outline" onClick={copyTempPassword}>
            <Copy className="w-4 h-4 mr-2 inline" /> Copy password
          </Button>

          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
