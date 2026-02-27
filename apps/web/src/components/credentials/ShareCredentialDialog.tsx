"use client";

import { useState, useEffect, useCallback } from "react";
import { Share2, X, Users, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserMultiSelect } from "./UserMultiSelect";
import { toast } from "@/components/ui/toast";
import {
  shareCredential,
  listCredentialShares,
  revokeCredentialAccess,
} from "@/lib/api/credentials";
import { listUsersForSharing } from "@/lib/api/users";
import { useAuth } from "@/lib/auth";
import type { CredentialShareInfo, UserBasicInfo} from "@/client/types.gen";

interface ShareCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentialId: number;
  credentialName: string;
  canShare: boolean;
  onSharesChanged?: () => void;
}

export function ShareCredentialDialog({
  open,
  onOpenChange,
  credentialId,
  credentialName,
  canShare,
  onSharesChanged,
}: ShareCredentialDialogProps) {
  const { state } = useAuth();
  const currentUserId = state.user?.id;

  const [shares, setShares] = useState<CredentialShareInfo[]>([]);
  const [users, setUsers] = useState<UserBasicInfo[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sharesRes, usersRes] = await Promise.all([
        listCredentialShares(credentialId),
        listUsersForSharing(),
      ]);

      if (sharesRes.data?.data) {
        setShares(sharesRes.data.data);
      }
      if (usersRes.data?.data) {
        setUsers(usersRes.data.data);
      }
    } catch (error) {
      toast.error("Failed to load sharing information");
    } finally {
      setIsLoading(false);
    }
  }, [credentialId]);

  // Load shares and users when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  // Filter out users who already have access and the current user (can't share with yourself)
  const availableUsers = users.filter(
    (user) =>
      user.id !== currentUserId &&
      !shares.some((share) => share.user_id === user.id)
  );

  // Helper to get user name by ID
  const getUserNameById = (userId: number | null): string | null => {
    if (!userId) return null;
    const user = users.find((u) => u.id === userId);
    return user?.name ?? null;
  };

  const handleShare = async () => {
    if (selectedUserIds.length === 0) {
      toast.error("Please select users to share with");
      return;
    }

    setIsSharing(true);
    try {
      await Promise.all(
        selectedUserIds.map((userId) =>
          shareCredential(credentialId, {
            user_id: userId,
          })
        )
      );

      // Refresh shares list to get updated data including timestamps/names
      const sharesRes = await listCredentialShares(credentialId);
      if (sharesRes.data?.data) {
        setShares(sharesRes.data.data);
      }

      setSelectedUserIds([]);
      toast.success("Credential shared successfully");
      onSharesChanged?.();
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to share credential";
      toast.error(message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async (userId: number) => {
    setRevokingUserId(userId);
    try {
      await revokeCredentialAccess(credentialId, userId);
      setShares((prev) => prev.filter((s) => s.user_id !== userId));
      toast.success("Access revoked successfully");
      onSharesChanged?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to revoke access";
      toast.error(message);
    } finally {
      setRevokingUserId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Credential
          </DialogTitle>
          <DialogDescription>
            Manage who has access to <strong>{credentialName}</strong>. Shared
            users can view and use this credential in their workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Add new share section */}
          {canShare && (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium">Share with people</label>
              <div className="flex flex-col gap-3">
                <UserMultiSelect
                  users={availableUsers}
                  selectedUserIds={selectedUserIds}
                  onSelect={(id) => setSelectedUserIds((prev) => [...prev, id])}
                  onRemove={(id) =>
                    setSelectedUserIds((prev) => prev.filter((uid) => uid !== id))
                  }
                  disabled={isLoading || isSharing}
                />

              </div>
            </div>
          )}

          {/* Current shares list */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Users with access ({shares.length})
            </label>

            {isLoading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                <span className="ml-2 text-sm">Loading...</span>
              </div>
            ) : shares.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                This credential hasn&apos;t been shared with anyone yet.
              </div>
            ) : (
              <div className="max-h-[200px] overflow-y-auto rounded-md border">
                {shares.map((share) => {
                  const sharedByName = getUserNameById(share.shared_by);
                  return (
                    <div
                      key={share.user_id}
                      className="flex items-center justify-between border-b p-3 last:border-b-0"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{share.user_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {share.user_email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Shared{" "}
                          {formatDistanceToNow(new Date(share.shared_at), {
                            addSuffix: true,
                          })}
                          {sharedByName && ` by ${sharedByName}`}
                        </span>
                      </div>
                      {canShare && (
                        <button
                          onClick={() => handleRevoke(share.user_id)}
                          disabled={revokingUserId === share.user_id}
                          title="Revoke access"
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {revokingUserId === share.user_id ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                          ) : (
                            <X className="h-5 w-5 text-red-500" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleShare}
            disabled={selectedUserIds.length === 0 || isSharing}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}
