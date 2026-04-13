"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const STORAGE_KEY_PREFIX = "admin_visibility_confirmed_";

export function AdminVisibilityModal() {
  const [open, setOpen] = useState(false);
  const { state } = useAuth();

  // Create a user-specific storage key
  const storageKey = state.user?.id ? `${STORAGE_KEY_PREFIX}${state.user.id}` : null;

  useEffect(() => {
    // Determine if user is not loaded or is an admin
    if (!state.user || state.user.role === "admin" || !storageKey) {
      return;
    }

    // Only access localStorage on the client to avoid hydration mismatch
    const hasConfirmed = localStorage.getItem(storageKey);
    if (!hasConfirmed) {
      setOpen(true);
    }
  }, [state.user, storageKey]);

  const handleConfirm = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, "true");
    }
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleConfirm();
    } else {
      setOpen(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Admin Visibility Notice</DialogTitle>
          <DialogDescription>
            Organization administrators can view your workflows, credentials, and data.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleConfirm}>I understand</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
