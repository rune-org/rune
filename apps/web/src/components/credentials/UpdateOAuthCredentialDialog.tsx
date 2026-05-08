"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { updateCredential } from "@/lib/api/credentials";
import { extractApiErrorMessage } from "@/lib/api/error";
import type { CredentialResponse } from "@/client/types.gen";

interface UpdateOAuthCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential: CredentialResponse | null;
  onUpdated: () => void;
}

export function UpdateOAuthCredentialDialog({
  open,
  onOpenChange,
  credential,
  onUpdated,
}: UpdateOAuthCredentialDialogProps) {
  const [clientId, setClientId] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [scope, setScope] = useState("");
  const [newClientSecret, setNewClientSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setClientId("");
      setAuthUrl("");
      setTokenUrl("");
      setScope("");
      setNewClientSecret("");
    }
  }, [open, credential?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential) return;

    const body: Record<string, string> = {};
    if (clientId.trim()) body.client_id = clientId.trim();
    if (authUrl.trim()) body.auth_url = authUrl.trim();
    if (tokenUrl.trim()) body.token_url = tokenUrl.trim();
    if (scope.trim()) body.scope = scope.trim();
    if (newClientSecret.trim()) body.client_secret = newClientSecret.trim();

    if (Object.keys(body).length === 0) {
      toast.error("Change at least one field, or cancel.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await updateCredential(credential.id, { credential_data: body });
      if (res.error) {
        toast.error(extractApiErrorMessage(res.error, "Failed to update OAuth settings."));
        return;
      }
      toast.success("OAuth settings updated. Reconnect if tokens were cleared.");
      onUpdated();
      onOpenChange(false);
    } catch {
      toast.error("Failed to update OAuth settings.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!credential) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Update OAuth settings</DialogTitle>
            <DialogDescription>
              Only fields you fill in are sent; everything else stays as stored on the server.
              Changing scopes or OAuth URLs clears tokens until you Connect again. Leave client
              secret empty to keep the current one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="oauth-client-id">Client ID (optional update)</Label>
              <Input
                id="oauth-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Leave blank to keep unchanged"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oauth-auth-url">Authorization URL (optional)</Label>
              <Input
                id="oauth-auth-url"
                value={authUrl}
                onChange={(e) => setAuthUrl(e.target.value)}
                placeholder="Leave blank to keep unchanged"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oauth-token-url">Token URL (optional)</Label>
              <Input
                id="oauth-token-url"
                value={tokenUrl}
                onChange={(e) => setTokenUrl(e.target.value)}
                placeholder="Leave blank to keep unchanged"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oauth-scope">Scopes (optional)</Label>
              <Input
                id="oauth-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Space-separated; leave blank to keep unchanged"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oauth-new-secret">New client secret (optional)</Label>
              <Input
                id="oauth-new-secret"
                type="password"
                value={newClientSecret}
                onChange={(e) => setNewClientSecret(e.target.value)}
                placeholder="Leave blank to keep current secret"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
