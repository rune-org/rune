"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, CheckCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string; 
}

interface ApiResponseUserResponse {
  data: UserResponse;
}

export default function UsersPage() {
  const { state } = useAuth();
  const user = state.user;

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [notification, setNotification] = useState("");

  if (!user) {
    return (
      <div className="p-10 text-muted-foreground text-sm">
        Loading user...
      </div>
    );
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  const filteredUsers = [user].filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSendInvite = () => {
    console.log("Invite email:", inviteEmail);
    console.log("Invite role:", inviteRole);
    // TODO: call API to send invite

    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("viewer");
    setNotification("Invitation sent");
  };

  // Automatically hide notification after 2 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(""), 2000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="flex flex-col w-full p-8 gap-6">

      {/* Centered Notification */}
      {notification && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-background border border-muted-foreground/20 text-muted-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 pointer-events-auto">
            <span>{notification}</span>
            <CheckCircle className="w-5 h-5 text-primary" />
          </div>
        </div>
      )}

      {/* 2FA Switch */}
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Enforce two-factor authentication</p>
          <p className="text-xs text-muted-foreground">
            Enforces 2FA for all users on this instance authenticating with email and password logins.
          </p>
        </div>
        <Switch 
          checked={twoFAEnabled} 
          onCheckedChange={(checked) => setTwoFAEnabled(checked)} 
        />
      </Card>

      {/* Users header and invite button */}
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

      {/* Search input */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search members..."
        className="px-3 py-2 rounded-md bg-muted text-sm border border-muted-foreground/20 focus:outline-none focus:ring"
      />

      {/* Users table */}
      <Card className="overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium">User</th>
              <th className="text-left py-3 px-4 font-medium">Account Type</th>
              <th className="text-left py-3 px-4 font-medium">Last Active</th>
              <th className="text-left py-3 px-4 font-medium">2FA</th>
              <th className="text-left py-3 px-4 font-medium">Projects</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.email} className="border-b hover:bg-muted/20 transition">
                <td className="py-4 px-4 flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </div>
                </td>

                <td className="py-4 px-4">Owner</td>
                <td className="py-4 px-4">Today</td>
                <td className="py-4 px-4 text-muted-foreground">{twoFAEnabled ? "Enabled" : "Disabled"}</td>
                <td className="py-4 px-4">All projects</td>
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
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button className="bg-primary text-white" onClick={handleSendInvite}>Send Invite</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
