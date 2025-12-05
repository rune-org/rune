"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, CheckCircle, AlertCircle } from "lucide-react";
import { getAllUsersUsersGet, createUserUsersPost } from "@/client";
import type { UserResponse, UserCreate } from "@/client/types.gen";

export default function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");

  const [notification, setNotification] = useState("");
  const [notificationType, setNotificationType] = useState<"success" | "error" | "info">("success");
  const [tempPassword, setTempPassword] = useState("");
  const [showNotification, setShowNotification] = useState(false);

  // Fetch users
  const fetchUsers = async () => {
    try {
      const res = await getAllUsersUsersGet();
      if (res.data?.data) setUsers(res.data.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Invite user
  const handleSendInvite = async () => {
    if (!inviteEmail) return;

    // Check if user already exists
    const alreadyExists = users.some((u) => u.email.toLowerCase() === inviteEmail.toLowerCase());
    if (alreadyExists) {
      setNotification("User is already in the project");
      setNotificationType("info"); // green
      setShowNotification(true);
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
        console.error("Failed to invite user:", error);
        setNotification("Failed to invite user");
        setNotificationType("error");
        setShowNotification(true);
        return;
      }

      if (data?.data?.temporary_password) {
        setTempPassword(data.data.temporary_password);
      }

      setNotification("Invitation sent");
      setNotificationType("success");
      setShowNotification(true);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("user");
      fetchUsers();
    } catch (err) {
      console.error("Failed to send invite:", err);
      setNotification("Failed to send invite");
      setNotificationType("error");
      setShowNotification(true);
    }
  };

  // Auto-hide notification with slide-out
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
        setNotification("");
        setTempPassword("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  // Filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full p-8 gap-6 relative">
      {loading && <div className="text-sm text-muted-foreground">Loading users...</div>}

      {/* Top-right toast notification */}
      {showNotification && (
        <div
          className={`fixed top-6 right-6 z-50 animate-slide-in-right ${
            !showNotification ? "animate-slide-out-right" : ""
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
            {notificationType === "success" || notificationType === "info" ? (
              <CheckCircle className="w-5 h-5 text-primary" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
        </div>
      )}

      {/* Users header & invite */}
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

      {/* Search bar */}
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
                  </div>
                </td>
                <td className="py-4 px-4">{u.role}</td>
                <td className="py-4 px-4">{u.email}</td>
              </tr>
            ))}
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

      {/* Animation classes */}
      <style jsx>{`
        @keyframes slide-in-right {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide-out-right {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out forwards; }
        .animate-slide-out-right { animation: slide-out-right 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
