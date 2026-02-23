"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Users, CheckCircle, Clock, Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface SecurityTabProps {
  users: User[];
  onRoleChange: (userId: number, newRole: string) => void;
  onRemoveUser: (userId: number) => void;
  onInviteUser: () => void;
  isInviteOpen: boolean;
  setIsInviteOpen: (open: boolean) => void;
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  inviteRole: string;
  setInviteRole: (role: string) => void;
}

export function SecurityTab({
  users,
  onRoleChange,
  onRemoveUser,
  onInviteUser,
  isInviteOpen,
  setIsInviteOpen,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole
}: SecurityTabProps) {
  return (
    <div className="space-y-6">
      {/* Roles Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="accent">Admin</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Full access: manage users, integrations, workflows, and settings.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">User</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Can create and edit workflows, manage personal credentials, view logs. Cannot manage other users or system-wide settings.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users List
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage workspace users and their permissions.
            </p>
          </div>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite User</DialogTitle>
                <DialogDescription>
                  Send an invite email with login link or account setup.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address(es)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="User">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={onInviteUser}>
                  Send Invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 gap-4 p-3 border-b font-medium text-sm">
                <div>Name</div>
                <div>Email</div>
                <div>Role</div>
                <div>Status</div>
              </div>
              {users.map((user) => (
                <div key={user.id} className="grid grid-cols-4 gap-4 p-3 border rounded-lg">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  <div>
                    <Select 
                      value={user.role} 
                      onValueChange={(value) => onRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="User">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={user.status === "Active" ? "default" : "secondary"}>
                      {user.status === "Active" ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {user.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveUser(user.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings (Basic)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require sign-in via email verification</Label>
              <p className="text-sm text-muted-foreground">
                Users must verify their email before accessing the workspace
              </p>
            </div>
            <Button variant="outline" size="sm">
              Enabled
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Two-Factor Authentication (2FA)</Label>
              <p className="text-sm text-muted-foreground">
                Coming soon - additional security layer for all users
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Future
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
