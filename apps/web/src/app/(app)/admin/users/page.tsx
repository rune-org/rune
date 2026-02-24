"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Trash2, Edit2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import type { UserResponse } from "@/client/types.gen";
import { useAuth } from "@/lib/auth";
import { useUserManagement } from "@/lib/hooks/useUserManagement";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { TempPasswordModal } from "@/components/admin/TempPasswordModal";

export default function UsersPage() {
  const router = useRouter();
  const { state } = useAuth();
  const currentUser = state.user;

  const { users, loading, fetchUsers, createUser, updateUser, deleteUser } = useUserManagement();

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);

  // Temporary password modal (persistent until closed)
  const [tempModalOpen, setTempModalOpen] = useState(false);
  const [tempModalEmail, setTempModalEmail] = useState("");
  const [tempModalPassword, setTempModalPassword] = useState("");

  // Edit user modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserResponse | null>(null);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      router.replace("/create");
    }
  }, [currentUser, router]);

  if (!currentUser) {
    return <div className="p-8 text-sm text-muted-foreground">Loading user...</div>;
  }
  if (currentUser.role !== "admin") {
    return null;
  }

  // Invite flow
  const handleSendInvite = async (name: string, email: string, role: "user" | "admin"): Promise<boolean> => {
    const created = await createUser(name, email, role);

    if (created) {
      // Success - close invite modal
      setInviteOpen(false);
      
      if (created.temporary_password && created.user) {
        // Show persistent modal so admin can copy
        setTempModalEmail(created.user.email ?? email);
        setTempModalPassword(created.temporary_password);
        setTempModalOpen(true);
      }
      return true;
    }
    // If created is null, keep modal open so user can retry
    return false;
  };

  // Open edit modal
  const openEditModal = (user: UserResponse) => {
    setEditingUser(user);
    setEditOpen(true);
  };

  // Update user (admin)
  const handleUpdateUser = async (name: string, email: string, role: "user" | "admin"): Promise<boolean> => {
    if (!editingUser) return false;

    const success = await updateUser(Number(editingUser.id), name, email, role);
    
    if (success) {
      // Only close and reset on success
      setEditOpen(false);
      setEditingUser(null);
      return true;
    }
    // If failed, keep modal open so user can retry
    return false;
  };

  // Delete flow
  const openDeleteConfirm = (user: UserResponse) => {
    setDeletingUser(user);
    setDeleteOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return false;

    const success = await deleteUser(Number(deletingUser.id));
    
    if (success) {
      setDeletingUser(null);
    }
    
    return success;
  };

  // Filtered users for table
  const filteredUsers = users.filter((u) =>
    `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full p-8 gap-6 relative">
      {/* Header */}
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Users
        </h2>

        <Button className="bg-primary hover:bg-primary/80 text-white" onClick={() => setInviteOpen(true)}>
          Invite
        </Button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search members..."
        className="px-3 py-2 rounded-md bg-muted text-sm border border-muted-foreground/20 focus:outline-none focus:ring"
      />

      {/* Users table */}
      <Card className="overflow-hidden border mt-4">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium">User</th>
              <th className="text-left py-3 px-4 font-medium">Role</th>
              <th className="text-left py-3 px-4 font-medium">Email</th>
              <th className="text-left py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  {loading ? "Loading users..." : "No users found."}
                </td>
              </tr>
            )}

            {filteredUsers.map((u) => (
              <tr key={u.id} className="border-b hover:bg-muted/20 transition">
                <td className="py-4 px-4 flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {u.name
                        ? u.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{u.name}</span>
                </td>

                <td className="py-4 px-4">{u.role}</td>
                <td className="py-4 px-4">{u.email}</td>

                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="p-2" onClick={() => openEditModal(u)} title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    {u.id !== currentUser.id && (
                      <Button variant="destructive" className="p-2" onClick={() => openDeleteConfirm(u)} title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Invite Modal */}
      <InviteUserDialog 
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleSendInvite}
      />

      {/* Temporary Password Modal */}
      <TempPasswordModal
        open={tempModalOpen}
        onClose={() => setTempModalOpen(false)}
        email={tempModalEmail}
        password={tempModalPassword}
      />

      {/* Edit Modal */}
      <EditUserDialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditingUser(null);
        }}
        user={editingUser}
        onUpdate={handleUpdateUser}
      />

      {/* Delete confirm modal */}
      <ConfirmationDialog
        open={deleteOpen && deletingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteOpen(false);
            setDeletingUser(null);
          }
        }}
        title="Delete user"
        description={
          <>
            Are you sure you want to permanently delete{" "}
            <strong>{deletingUser?.email}</strong>? This cannot be undone.
          </>
        }
        cancelText="Cancel"
        confirmText="Delete"
        onConfirm={handleDeleteUser}
        isDangerous
      />
    </div>
  );
}
