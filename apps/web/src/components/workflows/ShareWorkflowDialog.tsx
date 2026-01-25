"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  shareWorkflow,
  listWorkflowPermissions,
  revokeWorkflowAccess,
  updateWorkflowUserRole,
  type WorkflowPermission,
} from "@/lib/api/permissions";
import type { WorkflowRole } from "@/lib/permissions";
import { listUsersForSharingUsersSharingGet } from "@/client/sdk.gen";
import type { UserBasicInfo } from "@/client/types.gen";

interface ShareWorkflowDialogProps {
  workflowId: string;
  workflowName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareWorkflowDialog({
  workflowId,
  workflowName,
  open,
  onOpenChange,
}: ShareWorkflowDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<WorkflowRole>("viewer");
  const [permissions, setPermissions] = useState<WorkflowPermission[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserBasicInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // Load permissions and available users when dialog opens
  useEffect(() => {
    if (open) {
      void loadPermissions();
      void loadAvailableUsers();
    }
  }, [open, workflowId]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const perms = await listWorkflowPermissions(workflowId);
      setPermissions(perms);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load permissions"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const { data, error } = await listUsersForSharingUsersSharingGet();
      if (error) {
        throw new Error("Failed to load users");
      }
      setAvailableUsers(data?.data || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load users"
      );
    }
  };

  const handleAddUser = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    try {
      setLoading(true);
      await shareWorkflow(workflowId, parseInt(selectedUserId), selectedRole);
      toast.success(`Workflow shared with ${selectedRole} access`);
      setSelectedUserId("");
      setSelectedRole("viewer");
      await loadPermissions();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to share workflow"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (userId: number) => {
    try {
      setLoading(true);
      await revokeWorkflowAccess(workflowId, userId);
      toast.success("User access has been removed");
      await loadPermissions();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke access"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: number, newRole: WorkflowRole) => {
    try {
      setLoading(true);
      await updateWorkflowUserRole(workflowId, userId, newRole);
      toast.success(`User role changed to ${newRole}`);
      await loadPermissions();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Share "{workflowName}"</DialogTitle>
          <DialogDescription>
            Manage who has access to this workflow and their permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add People Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Add People</h3>
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="user-select" className="sr-only">
                  Select User
                </Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={loading}
                >
                  <SelectTrigger id="user-select">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers
                      .filter((user) => !permissions.some((p) => p.user_id === user.id))
                      .map((user) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as WorkflowRole)}
                disabled={loading}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddUser} disabled={loading || !selectedUserId}>
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              • <strong>Viewer:</strong> Can view workflow only
              <br />• <strong>Editor:</strong> Can view, edit, and run workflow
            </p>
          </div>

          {/* People with Access Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">People with Access</h3>
            {loading && permissions.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Loading...
              </div>
            ) : permissions.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No shared access yet
              </div>
            ) : (
              <div className="space-y-2">
                {permissions.map((perm) => (
                  <div
                    key={perm.user_id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{perm.user_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {perm.user_email}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {perm.role === "owner" ? (
                        <Badge variant="secondary">Owner</Badge>
                      ) : (
                        <>
                          <Select
                            value={perm.role}
                            onValueChange={(value) =>
                              handleUpdateRole(perm.user_id, value as WorkflowRole)
                            }
                            disabled={loading}
                          >
                            <SelectTrigger className="w-[120px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRevokeAccess(perm.user_id)}
                            disabled={loading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
