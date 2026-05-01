"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X, Loader2 } from "lucide-react";
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
import { listUsersForSharing } from "@/lib/api/users";
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
  const [searchResults, setSearchResults] = useState<UserBasicInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userToRevoke, setUserToRevoke] = useState<{ id: number; name: string } | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive available users by excluding those who already have permissions
  const availableUsers = useMemo(() => {
    const existing = new Set(permissions.map((p) => p.user_id));
    return searchResults.filter((u) => !existing.has(u.id));
  }, [searchResults, permissions]);

  // Check if selected user is an admin
  const selectedUser = availableUsers.find((u) => u.id === parseInt(selectedUserId || "0"));
  const isSelectedUserAdmin = selectedUser?.role === "admin";

  // Load permissions when dialog opens; reset search state
  useEffect(() => {
    if (open) {
      void loadPermissions();
      setSearchResults([]);
      setSearchQuery("");
      setSelectedUserId("");
      setSelectedRole("viewer");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workflowId]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const perms = await listWorkflowPermissions(workflowId);
      setPermissions(perms);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const res = await listUsersForSharing(query || undefined);
      setSearchResults(res.data?.data ?? []);
    } catch (_error) {
      toast.error("Failed to search users");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setDropdownOpen(true);
    setSelectedUserId("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void handleSearch(value), 300);
  };

  const handleSelectUser = (user: UserBasicInfo) => {
    setSelectedUserId(String(user.id));
    setSearchQuery(`${user.name} (${user.email})`);
    setDropdownOpen(false);
  };

  const handleAddUser = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    try {
      setLoading(true);
      // If selected user is admin, always use editor role
      const roleToUse = isSelectedUserAdmin ? "editor" : selectedRole;
      await shareWorkflow(workflowId, parseInt(selectedUserId), roleToUse);
      toast.success(`Workflow shared with ${roleToUse} access`);
      setSelectedUserId("");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedRole("viewer");
      await loadPermissions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to share workflow");
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
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke access");
      return false;
    } finally {
      setLoading(false);
      setUserToRevoke(null);
    }
  };

  const handleUpdateRole = async (userId: number, newRole: WorkflowRole) => {
    try {
      setLoading(true);
      await updateWorkflowUserRole(workflowId, userId, newRole);
      toast.success(`User role changed to ${newRole}`);
      await loadPermissions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle>Share &quot;{workflowName}&quot;</DialogTitle>
          <DialogDescription>
            Manage who has access to this workflow and their permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Add People Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Add People</h3>
            <div className="flex gap-2">
              <div className="flex-1 space-y-2" ref={searchWrapperRef}>
                <Label htmlFor="user-search" className="sr-only">
                  Search User
                </Label>
                <div className="relative">
                  <input
                    id="user-search"
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInput}
                    onFocus={() => {
                      if (searchQuery) setDropdownOpen(true);
                    }}
                    placeholder="Search by name or email..."
                    disabled={loading}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-8"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {dropdownOpen && availableUsers.length > 0 && (
                    <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                      <div className="max-h-[180px] overflow-y-auto p-1">
                        {availableUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex cursor-pointer select-none flex-col rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectUser(user)}
                          >
                            <span>{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {dropdownOpen &&
                    !isSearching &&
                    availableUsers.length === 0 &&
                    searchQuery &&
                    !selectedUserId && (
                      <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-lg">
                        No users found.
                      </div>
                    )}
                </div>
              </div>

              {!isSelectedUserAdmin && (
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
              )}
              <Button onClick={handleAddUser} disabled={loading || !selectedUserId}>
                Add
              </Button>
            </div>
            {isSelectedUserAdmin && (
              <p className="text-xs text-blue-400">
                Note: Admin users automatically have full privileges (editor access) on all
                workflows.
              </p>
            )}
            {!isSelectedUserAdmin && (
              <p className="text-xs text-muted-foreground">
                • <strong>Viewer:</strong> Can view workflow only
                <br />• <strong>Editor:</strong> Can view, edit, and run workflow
              </p>
            )}
          </div>

          {/* People with Access Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">People with Access</h3>
            {loading && permissions.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
            ) : permissions.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No shared access yet
              </div>
            ) : (
              <div className="space-y-2">
                {permissions.map((perm) => {
                  // Check if this shared user is an admin
                  const isSharedUserAdmin = perm.user_role === "admin";

                  return (
                    <div
                      key={perm.user_id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{perm.user_name}</div>
                        <div className="text-xs text-muted-foreground">{perm.user_email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {perm.role === "owner" ? (
                          <Badge variant="secondary">Owner</Badge>
                        ) : (
                          <>
                            {isSharedUserAdmin ? (
                              <Badge variant="outline" className="capitalize">
                                {perm.role}
                              </Badge>
                            ) : (
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
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() =>
                                setUserToRevoke({ id: perm.user_id, name: perm.user_name })
                              }
                              disabled={loading}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      <ConfirmationDialog
        open={userToRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setUserToRevoke(null);
        }}
        title="Remove Access"
        description={
          <>
            Are you sure you want to remove <strong>{userToRevoke?.name}</strong>&apos;s access to
            this workflow? They will no longer be able to view or edit it.
          </>
        }
        confirmText="Remove Access"
        cancelText="Cancel"
        onConfirm={async () => {
          if (userToRevoke) {
            return await handleRevokeAccess(userToRevoke.id);
          }
          return false;
        }}
        isDangerous={true}
        isLoading={loading}
      />
    </Dialog>
  );
}
