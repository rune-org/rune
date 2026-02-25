"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface TempPasswordModalProps {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
}

export function TempPasswordModal({ open, onClose, email, password }: TempPasswordModalProps) {
  if (!open) return null;

  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied to clipboard");
    } catch (err) {
      console.error("Clipboard copy failed", err);
      toast.error("Failed to copy password");
    }
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent backdrop click from closing when clicking inside card
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50"
      onClick={onClose}
    >
      <Card 
        className="p-6 w-full max-w-md bg-background border"
        onClick={handleCardClick}
      >
        <h3 className="text-lg font-semibold mb-2">Invitation created</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Share the temporary password with the new user so they can sign in and change it.
        </p>

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
      </Card>
    </div>
  );
}
