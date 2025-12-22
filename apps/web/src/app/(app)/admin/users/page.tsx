"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Trash2, Edit2, Copy } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  getAllUsersUsersGet,
  createUserUsersPost,
  updateUserUsersUserIdPut,
  deleteUserUsersUserIdDelete,
} from "@/client";
import type { UserResponse, UserCreate, AdminUserUpdate, CreateUserResponse } from "@/client/types.gen";
import { useAuth } from "@/lib/auth";

export default function UsersPage() {
  const router = useRouter();
  const { state } = useAuth();
  const currentUser = state.user;

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");

  // Temporary password modal (persistent until closed)
  const [tempModalOpen, setTempModalOpen] = useState(false);
  const [tempModalEmail, setTempModalEmail] = useState("");
  const [tempModalPassword, setTempModalPassword] = useState("");

  // Edit user modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserResponse | null>(null);

  // Fetch users from backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await getAllUsersUsersGet();
      
      if (res.data?.data) {
        setUsers(res.data.data);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
  const handleSendInvite = async () => {
    if (!inviteEmail) {
      toast.error("Please enter an email");
      return;
    }
    if (!inviteName) {
      toast.error("Please enter a name");
      return;
    }

    // Basic client-side email normalization & check
    const normalized = inviteEmail.trim().toLowerCase();

    // Prevent inviting existing users
    const alreadyExists = users.some((u) => u.email.toLowerCase() === normalized);
    if (alreadyExists) {
      // Show green/info toast per your request
      toast.info("User is already in the organization");
      return;
    }

    const payload: UserCreate = {
      name: inviteName,
      email: normalized,
      role: inviteRole,
    };

    try {
      const { data, error } = await createUserUsersPost({ body: payload });

      if (error) {
        console.error("Failed to create user:", error);
        // If backend returns validation messages, they may be on error; show generic message
        toast.error("Failed to create user");
        return;
      }

      const created = data?.data as CreateUserResponse | undefined;

      // If we got a created user + temporary password, open the persistent modal
      if (created?.temporary_password && created?.user) {
        // Show persistent modal so admin can copy
        setTempModalEmail(created.user.email ?? normalized);
        setTempModalPassword(created.temporary_password);
        setTempModalOpen(true);
      } else {
        // fallback: simple toast
        toast.success("Invitation sent");
      }

      // Reset invite UI & refresh list
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("user");
      await fetchUsers();
    } catch (err) {
      console.error("Failed to send invite:", err);
      toast.error("Failed to send invite");
    }
  };

  // Copy temporary password
  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempModalPassword);
      toast.success("Password copied to clipboard");
    } catch (err) {
      console.error("Clipboard copy failed", err);
      toast.error("Failed to copy password");
    }
  };

  // Open edit modal
  const openEditModal = (user: UserResponse) => {
    setEditingUser(user);
    setEditName(user.name ?? "");
    setEditEmail(user.email ?? "");
    setEditRole((user.role as "user" | "admin") ?? "user");
    setEditOpen(true);
  };

  // Update user (admin)
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const payload: AdminUserUpdate = {
      name: editName,
      email: editEmail,
      role: editRole,
    };

    try {
      const { error } = await updateUserUsersUserIdPut({
        path: { user_id: Number(editingUser.id) },
        body: payload,
      });

      if (error) {
        console.error("Failed to update user:", error);
        toast.error("Failed to update user");
        return;
      }

      toast.success("User updated");
      setEditOpen(false);
      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      console.error("Failed to update user:", err);
      toast.error("Failed to update user");
    }
  };

  // Delete flow
  const openDeleteConfirm = (user: UserResponse) => {
    setDeletingUser(user);
    setDeleteOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      const { error } = await deleteUserUsersUserIdDelete({
        path: { user_id: Number(deletingUser.id) },
      });

      if (error) {
        console.error("Failed to delete user:", error);
        toast.error("Failed to delete user");
        return;
      }

      toast.success("User deleted");
      setDeleteOpen(false);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
      toast.error("Failed to delete user");
    }
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
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-40">
          <Card className="p-6 w-full max-w-md bg-background border">
            <h3 className="text-lg font-semibold mb-4">Invite User</h3>

            <input
              type="text"
              placeholder="Full Name"
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-3"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />

            <input
              type="email"
              placeholder="User email"
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-4"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Role</label>
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
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-primary text-white" onClick={handleSendInvite}>
                Send Invite
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Temporary Password Modal (persistent until admin closes) */}
      {tempModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <Card className="p-6 w-full max-w-md bg-background border">
            <h3 className="text-lg font-semibold mb-2">Invitation created</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share the temporary password with the new user so they can sign in and change it.
            </p>

            <div className="mb-4 p-4 bg-muted rounded">
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="font-medium">{tempModalEmail}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Temporary password</div>
                  <div className="font-mono font-medium text-lg">{tempModalPassword}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2">
              <Button variant="outline" onClick={copyTempPassword}>
                <Copy className="w-4 h-4 mr-2 inline" /> Copy password
              </Button>

              <Button variant="outline" onClick={() => setTempModalOpen(false)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && editingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <Card className="p-6 w-full max-w-md bg-background border">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>

            <label className="text-xs text-muted-foreground">Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-3"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />

            <label className="text-xs text-muted-foreground">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-3"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />

            <label className="text-xs text-muted-foreground">Role</label>
            <select
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-4"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as "user" | "admin")}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button className="bg-primary text-white" onClick={handleUpdateUser}>Save</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteOpen && deletingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <Card className="p-6 w-full max-w-md bg-background border">
            <h3 className="text-lg font-semibold mb-4">Delete user</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to permanently delete <strong>{deletingUser.email}</strong>? This cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button className="bg-red-600 text-white" onClick={handleDeleteUser}>Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
