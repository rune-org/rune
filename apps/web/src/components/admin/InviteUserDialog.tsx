"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onInvite: (name: string, email: string, role: "user" | "admin") => Promise<void>;
}

export function InviteUserDialog({ open, onClose, onInvite }: InviteUserDialogProps) {
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleInvite = async () => {
    setIsSubmitting(true);
    try {
      await onInvite(inviteName, inviteEmail, inviteRole);
      // Reset form
      setInviteName("");
      setInviteEmail("");
      setInviteRole("user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-40">
      <Card className="p-6 w-full max-w-md bg-background border">
        <h3 className="text-lg font-semibold mb-4">Invite User</h3>

        <Input
          type="text"
          placeholder="Full Name"
          className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-3"
          value={inviteName}
          onChange={(e) => setInviteName(e.target.value)}
        />

        <Input
          type="email"
          placeholder="User email"
          className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-4"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
        />

        <div className="mb-4">
          <Label className="block text-sm font-medium mb-1">Role</Label>
          <select
            className="w-full px-3 py-2 rounded-md bg-muted border text-sm"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "user" | "admin")}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            className="bg-primary text-white" 
            onClick={handleInvite}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
