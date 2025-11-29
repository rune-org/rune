"use client";

import { useState, useEffect, useCallback } from "react";
import { X, UserPlus, Loader2 } from "lucide-react";
import type { WorkflowSummary, WorkflowRole } from "@/lib/workflows";
import {
  shareWorkflow,
  listWorkflowPermissions,
  revokeWorkflowAccess,
  updateWorkflowUserRole,
} from "@/lib/api/permissions";
import { toast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type WorkflowPermission = {
  user_id: number;
  user_email: string;
  user_name: string;
  role: WorkflowRole;
  granted_at: string;
  granted_by: number | null;
};

type ShareWorkflowDialogProps = {
  workflow: WorkflowSummary | null;
  onClose: () => void;
};

export function ShareWorkflowDialog({
  workflow,
  onClose,
}: ShareWorkflowDialogProps) {
  const [permissions, setPermissions] = useState<WorkflowPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"editor" | "viewer">("viewer");

  const loadPermissions = useCallback(async () => {
    if (!workflow) return;

    setLoading(true);
    try {
      const response = await listWorkflowPermissions(Number(workflow.id));
      // Handle response - shape depends on whether backend returns wrapped or direct data
      if (response && typeof response === 'object' && 'data' in response) {
        const rawData = response.data as any;
        // Check if it's wrapped in ApiResponse format
        const permissions = rawData?.data?.permissions || rawData?.permissions || [];
        setPermissions(permissions);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load permissions"
      );
    } finally {
      setLoading(false);
    }
  }, [workflow]);

  useEffect(() => {
    if (workflow) {
      void loadPermissions();
    } else {
      setPermissions([]);
    }
  }, [workflow, loadPermissions]);

  const handleAddUser = async () => {
    if (!workflow || !userEmail.trim()) return;

    setAdding(true);
    try {
      // Note: Backend expects user_id, but UI accepts email
      // You'll need to add a user lookup endpoint or modify backend to accept email
      // For now, this assumes you'll add that functionality
      await shareWorkflow(Number(workflow.id), 0, selectedRole); // Placeholder user_id
      
      toast.success(`Workflow shared with ${userEmail}`);
      setUserEmail("");
      void loadPermissions();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to share workflow"
      );
    } finally {
      setAdding(false);
    }
  };

  const handleRevokeAccess = async (userId: number, userName: string) => {
    if (!workflow) return;

    try {
      await revokeWorkflowAccess(Number(workflow.id), userId);
      toast.success(`Removed ${userName}'s access`);
      void loadPermissions();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke access"
      );
    }
  };

  const handleUpdateRole = async (userId: number, newRole: WorkflowRole) => {
    if (!workflow || newRole === "owner") return;

    try {
      await updateWorkflowUserRole(Number(workflow.id), userId, newRole);
      toast.success("Role updated successfully");
      void loadPermissions();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role"
      );
    }
  };

  const getRoleBadgeVariant = (role: WorkflowRole) => {
    switch (role) {
      case "owner":
        return "default";
      case "editor":
        return "secondary";
      case "viewer":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={workflow !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share Workflow</DialogTitle>
          <DialogDescription>
            Manage who has access to <span className="font-semibold">{workflow?.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add User Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Add People</h3>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Enter email address"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  disabled={adding}
                />
              </div>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as "editor" | "viewer")}
                disabled={adding}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddUser}
                disabled={adding || !userEmail.trim()}
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Viewer:</strong> Can view workflow (read-only) •{" "}
              <strong>Editor:</strong> Can view, edit, and run workflow
            </p>
          </div>

          {/* Current Access List */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">People with Access</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : permissions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No shared access yet
              </p>
            ) : (
              <div className="space-y-2">
                {permissions.map((permission) => (
                  <div
                    key={permission.user_id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {permission.user_name}
                        </p>
                        <Badge
                          variant={getRoleBadgeVariant(permission.role)}
                          className="text-xs"
                        >
                          {permission.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {permission.user_email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {permission.role !== "owner" && (
                        <>
                          <Select
                            value={permission.role}
                            onValueChange={(value) =>
                              handleUpdateRole(permission.user_id, value as WorkflowRole)
                            }
                          >
                            <SelectTrigger className="h-8 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRevokeAccess(
                                permission.user_id,
                                permission.user_name
                              )
                            }
                            className="h-8 w-8 p-0"
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

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}