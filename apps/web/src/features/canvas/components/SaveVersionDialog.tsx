"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SaveVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (message: string) => void;
  isSaving?: boolean;
}

export function SaveVersionDialog({
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: SaveVersionDialogProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(message.trim());
    setMessage("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isSaving) {
          onOpenChange(o);
          if (!o) setMessage("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save version</DialogTitle>
          <DialogDescription>Add an optional message describing this version.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="version-message">Message</Label>
            <Input
              id="version-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What changed?"
              disabled={isSaving}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
                setMessage("");
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save version"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
