"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserResponse } from "@/client/types.gen";

interface EditUserDialogProps {
  open: boolean;
  onClose: () => void;
  user: UserResponse | null;
  onUpdate: (name: string, email: string, role: "user" | "admin") => Promise<void>;
}

export function EditUserDialog({ open, onClose, user, onUpdate }: EditUserDialogProps) {
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setEditName(user.name ?? "");
      setEditEmail(user.email ?? "");
      setEditRole((user.role as "user" | "admin") ?? "user");
    }
  }, [user]);

  if (!open || !user) return null;

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      await onUpdate(editName, editEmail, editRole);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
      <Card className="p-6 w-full max-w-md bg-background border">
        <h3 className="text-lg font-semibold mb-4">Edit User</h3>

        <Label className="text-xs text-muted-foreground">Name</Label>
        <Input
          type="text"
          className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-3"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
        />

        <Label className="text-xs text-muted-foreground">Email</Label>
        <Input
          type="email"
          className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-3"
          value={editEmail}
          onChange={(e) => setEditEmail(e.target.value)}
        />

        <Label className="text-xs text-muted-foreground">Role</Label>
        <select
          className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-4"
          value={editRole}
          onChange={(e) => setEditRole(e.target.value as "user" | "admin")}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            className="bg-primary text-white" 
            onClick={handleUpdate}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
