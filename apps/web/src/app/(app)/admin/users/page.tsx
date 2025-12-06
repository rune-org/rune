"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, CheckCircle, AlertCircle, Trash2, Edit2, Copy } from "lucide-react";

import {
  getAllUsersUsersGet,
  createUserUsersPost,
  updateUserUsersUserIdPut,
  deleteUserUsersUserIdDelete,
} from "@/client";

import type {
  UserResponse,
  UserCreate,
  AdminUserUpdate,
} from "@/client/types.gen";

/**
 * Admin Users management page
 *
 * Features:
 * - list users (search)
 * - invite user (create) -> shows temporary password in a modal with copy button
 * - edit user (admin_update_user)
 * - delete user (delete_user) with confirmation
 * - animated top-right toasts (slide-in/out)
 */

export default function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // search
  const [searchQuery, setSearchQuery] = useState("");

  // invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");

  // temporary password modal (persistent until admin closes)
  const [tempModalOpen, setTempModalOpen] = useState(false);
  const [tempModalEmail, setTempModalEmail] = useState("");
  const [tempModalPassword, setTempModalPassword] = useState("");

  // edit user modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");

  // delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserResponse | null>(null);

  // notifications (top-right)
  const [notification, setNotification] = useState("");
  const [notificationType, setNotificationType] = useState<
    "success" | "error" | "info"
  >("success");
  const [tempPassword, setTempPassword] = useState("");
  const [showToast, setShowToast] = useState(false);

  // fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await getAllUsersUsersGet();
      if (res.data?.data) setUsers(res.data.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
      setNotification("Failed to fetch users");
      setNotificationType("error");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // helper: show toast
  const showNotification = (
    message: string,
    type: "success" | "error" | "info" = "success",
    tempPwd?: string
  ) => {
    setNotification(message);
    setNotificationType(type);
    if (tempPwd) setTempPassword(tempPwd);
    setShowToast(true);
  };

  // auto-hide toast with slide out
  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => {
      setShowToast(false);
      setNotification("");
      setTempPassword("");
    }, 4000);
    return () => clearTimeout(timer);
  }, [showToast]);

  // invite user
  const handleSendInvite = async () => {
    if (!inviteEmail) return;

    // check exists locally
    const alreadyExists = users.some(
      (u) => u.email.toLowerCase() === inviteEmail.toLowerCase()
    );
    if (alreadyExists) {
      // show green/info toast for already-in-project
      showNotification("User is already in the project", "info");
      return;
    }

    const payload: UserCreate = {
      name: inviteEmail.split("@")[0],
      email: inviteEmail,
      role: inviteRole,
    };

    try {
      const { data, error } = await createUserUsersPost({ body: payload });

      if (error) {
        console.error("Failed to create user:", error);
        showNotification("Failed to create user", "error");
        return;
      }

      // createUser response wrapper: data?.data?.temporary_password
      const tmp = data?.data?.temporary_password;
      const createdUser = data?.data?.user;

      // refresh and show persistent modal with temp password for admin to copy
      await fetchUsers();

      if (tmp && createdUser) {
        setTempModalEmail(createdUser.email ?? inviteEmail);
        setTempModalPassword(tmp);
        setTempModalOpen(true); // persistent until closed
      } else {
        // fallback: simple toast
        showNotification("Invitation sent", "success");
      }

      // reset invite fields
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("user");
    } catch (err) {
      console.error("Failed to send invite:", err);
      showNotification("Failed to send invite", "error");
    }
  };

  // copy temp password to clipboard
  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempModalPassword);
      showNotification("Password copied to clipboard", "success");
    } catch (err) {
      console.error("Clipboard copy failed", err);
      showNotification("Failed to copy password", "error");
    }
  };

  // open edit modal with user data
  const openEditModal = (user: UserResponse) => {
    setEditingUser(user);
    setEditName(user.name ?? "");
    setEditEmail(user.email ?? "");
    setEditRole((user.role as "user" | "admin") ?? "user");
    setEditOpen(true);
  };

  // submit admin update
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const payload: AdminUserUpdate = {
      // we assume AdminUserUpdate accepts partial fields; using any-cast so TS won't block here
      // if your types require explicit shape, adapt accordingly
      ...({
        name: editName,
        email: editEmail,
        role: editRole,
      } as any),
    };

    try {
      const { data, error } = await updateUserUsersUserIdPut({
        path: { user_id: Number(editingUser.id) },
        body: payload,
      });

      if (error) {
        console.error("Failed to update user:", error);
        showNotification("Failed to update user", "error");
        return;
      }

      showNotification("User updated", "success");
      setEditOpen(false);
      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      console.error("Failed to update user:", err);
      showNotification("Failed to update user", "error");
    }
  };

  // open delete confirmation
  const openDeleteConfirm = (user: UserResponse) => {
    setDeletingUser(user);
    setDeleteOpen(true);
  };

  // perform delete
  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      const { data, error } = await deleteUserUsersUserIdDelete({
        path: { user_id: Number(deletingUser.id) },
      });

      if (error) {
        console.error("Failed to delete user:", error);
        showNotification("Failed to delete user", "error");
        return;
      }

      showNotification("User deleted", "success");
      setDeleteOpen(false);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
      showNotification("Failed to delete user", "error");
    }
  };

  // filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full p-8 gap-6 relative">
      {loading && (
        <div className="text-sm text-muted-foreground">Loading users...</div>
      )}

      {/* Top-right toast */}
      {showToast && (
        <div
          className={`fixed top-6 right-6 z-50 ${
            showToast ? "animate-slide-in-right" : "animate-slide-out-right"
          }`}
        >
          <div
            className={`${
              notificationType === "success"
                ? "bg-background border border-muted-foreground/20 text-muted-foreground"
                : notificationType === "info"
                ? "bg-background border border-green-500 text-green-600"
                : "bg-background border border-red-500 text-red-600"
            } px-6 py-3 rounded-lg shadow-lg flex items-center gap-3`}
          >
            <span>
              {notification}
              {notificationType === "success" && tempPassword
                ? ` — Temporary password: ${tempPassword}`
                : ""}
            </span>
            {notificationType === "success" ||
            notificationType === "info" ? (
              <CheckCircle className="w-5 h-5 text-primary" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mt-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" /> Users
        </h2>

        <Button
          className="bg-primary hover:bg-primary/80 text-white"
          onClick={() => setInviteOpen(true)}
        >
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
                  <div className="flex flex-col">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </div>
                </td>

                <td className="py-4 px-4">{u.role}</td>
                <td className="py-4 px-4">{u.email}</td>

                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => openEditModal(u)}
                      title="Edit user"
                      className="p-2"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() => openDeleteConfirm(u)}
                      title="Delete user"
                      className="p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6">
          <Card className="p-6 w-full max-w-md bg-background border">
            <h3 className="text-lg font-semibold mb-4">Invite User</h3>

            <input
              type="email"
              placeholder="User email"
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm mb-4"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />

            {/* Role selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                className="w-full px-3 py-2 rounded-md bg-muted border text-sm"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "user" | "admin")
                }
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-40">
          <Card className="p-6 w-full max-w-md bg-background border">
            <h3 className="text-lg font-semibold mb-2">Invitation created</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share the temporary password with the new user so they can sign in and change it.
            </p>

            <div className="mb-4 p-4 bg-muted rounded">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="font-medium">{tempModalEmail}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Temporary password</div>
                  <div className="font-mono font-medium">{tempModalPassword}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => { copyTempPassword(); }}>
                <Copy className="w-4 h-4 mr-2" /> Copy password
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setTempModalOpen(false)}>Close</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      {editOpen && editingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-40">
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

      {/* Delete Confirmation Modal */}
      {deleteOpen && deletingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-40">
          <Card className="p-6 w-full max-w-md bg-background border">
            <h3 className="text-lg font-semibold mb-4">Delete user</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to permanently delete <strong>{deletingUser.email}</strong>? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button className="bg-red-600 text-white" onClick={handleDeleteUser}>Delete</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes slide-in-right {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide-out-right {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.25s ease-out forwards; }
        .animate-slide-out-right { animation: slide-out-right 0.25s ease-out forwards; }
      `}</style>
    </div>
  );
}
