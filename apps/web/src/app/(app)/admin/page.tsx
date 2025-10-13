"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Users, 
  Settings as SettingsIcon, 
  Bell, 
  Info, 
  UserPlus, 
  Mail, 
  Trash2, 
  Edit, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Upload,
  Link,
  ExternalLink,
  MessageCircle,
  Bug,
  FileText,
  Zap,
  BarChart3
} from "lucide-react";

// Mock data
const users = [
  { id: 1, name: "Shehab Mahmoud", email: "shehab@rune.com", role: "Admin", status: "Active" },
  { id: 2, name: "John Doe", email: "john@example.com", role: "User", status: "Active" },
  { id: 3, name: "Jane Smith", email: "jane@example.com", role: "User", status: "Pending" },
];

export default function AdminPage() {
  const [selectedTab, setSelectedTab] = useState("general");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("User");
  
  // General Settings State
  const [generalSettings, setGeneralSettings] = useState({
    workspaceName: "Acme Automations",
    workspaceLogo: null,
    baseUrl: "https://acme.rune.app",
    timezone: "UTC",
    locale: "English (US)",
  });

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    alertRecipients: ["all-admins"],
    errorThreshold: 3,
    workflowLevelAlerts: true,
    webhookUrl: "",
    dailySummary: false,
  });

  const handleInviteUser = () => {
    // Handle user invitation
    console.log("Inviting user:", { email: inviteEmail, role: inviteRole });
    setIsInviteOpen(false);
    setInviteEmail("");
    setInviteRole("User");
  };

  const handleRemoveUser = (userId: number) => {
    // Handle user removal
    console.log("Removing user:", userId);
  };

  const handleRoleChange = (userId: number, newRole: string) => {
    // Handle role change
    console.log("Changing role for user:", userId, "to:", newRole);
  };

  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Admin Settings"
        description="Manage users, workspace settings, and system configuration."
      />

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users & Permissions
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="about" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            About & Support
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure workspace name, branding, and basic settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    value={generalSettings.workspaceName}
                    onChange={(e) => setGeneralSettings({...generalSettings, workspaceName: e.target.value})}
                    placeholder="The display name for this Rune workspace"
                  />
                  <p className="text-xs text-muted-foreground">
                    Appears in the top bar and workflow listings.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workspace-logo">Workspace Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Optional logo shown in the top-left and workflow cards.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="base-url">Base URL / Callback URL</Label>
                  <Input
                    id="base-url"
                    value={generalSettings.baseUrl}
                    onChange={(e) => setGeneralSettings({...generalSettings, baseUrl: e.target.value})}
                    placeholder="https://your-workspace.rune.app"
                  />
                  <p className="text-xs text-muted-foreground">
                    The public URL where workflows execute callbacks and integrations return data. Used for webhooks and OAuth redirects.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Default Time Zone</Label>
                    <Select value={generalSettings.timezone} onValueChange={(value) => setGeneralSettings({...generalSettings, timezone: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="UTC-8">Pacific Time (UTC-8)</SelectItem>
                        <SelectItem value="UTC-5">Eastern Time (UTC-5)</SelectItem>
                        <SelectItem value="UTC+1">Central European Time (UTC+1)</SelectItem>
                        <SelectItem value="UTC+9">Japan Standard Time (UTC+9)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Used for scheduling and displaying execution times.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="locale">Default Locale</Label>
                    <Select value={generalSettings.locale} onValueChange={(value) => setGeneralSettings({...generalSettings, locale: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English (US)">English (US)</SelectItem>
                        <SelectItem value="English (UK)">English (UK)</SelectItem>
                        <SelectItem value="Español">Español</SelectItem>
                        <SelectItem value="Français">Français</SelectItem>
                        <SelectItem value="Deutsch">Deutsch</SelectItem>
                        <SelectItem value="日本語">日本語</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      UI date/time formatting.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>Save Changes</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users & Permissions Tab */}
        <TabsContent value="users" className="space-y-6">
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
                      <Badge variant="destructive">Admin</Badge>
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
                <CardDescription>
                  Manage workspace users and their permissions.
                </CardDescription>
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
                    <Button onClick={handleInviteUser}>
                      <Mail className="h-4 w-4 mr-2" />
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
                          onValueChange={(value) => handleRoleChange(user.id, value)}
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
                          onClick={() => handleRemoveUser(user.id)}
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
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications & Alerts
              </CardTitle>
              <CardDescription>
                Configure system-wide notification settings and alert thresholds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send notifications for failed executions.
                    </p>
                  </div>
                  <Button
                    variant={notificationSettings.emailNotifications ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNotificationSettings({...notificationSettings, emailNotifications: !notificationSettings.emailNotifications})}
                  >
                    {notificationSettings.emailNotifications ? "On" : "Off"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Alert Recipients</Label>
                  <Select 
                    value={notificationSettings.alertRecipients[0]} 
                    onValueChange={(value) => setNotificationSettings({...notificationSettings, alertRecipients: [value]})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-admins">All admins</SelectItem>
                      <SelectItem value="workflow-owners">Workflow owners only</SelectItem>
                      <SelectItem value="custom">Custom recipients</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Users who receive alerts.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="error-threshold">Error Threshold Alerts</Label>
                  <Input
                    id="error-threshold"
                    type="number"
                    value={notificationSettings.errorThreshold}
                    onChange={(e) => setNotificationSettings({...notificationSettings, errorThreshold: parseInt(e.target.value)})}
                    className="w-24"
                  />
                  <p className="text-sm text-muted-foreground">
                    Notify after X consecutive failures.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Workflow-Level Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow per-workflow overrides.
                    </p>
                  </div>
                  <Button
                    variant={notificationSettings.workflowLevelAlerts ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNotificationSettings({...notificationSettings, workflowLevelAlerts: !notificationSettings.workflowLevelAlerts})}
                  >
                    {notificationSettings.workflowLevelAlerts ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook Notifications</Label>
                  <Input
                    id="webhook-url"
                    value={notificationSettings.webhookUrl}
                    onChange={(e) => setNotificationSettings({...notificationSettings, webhookUrl: e.target.value})}
                    placeholder="https://your-webhook-endpoint.com"
                  />
                  <p className="text-sm text-muted-foreground">
                    POST JSON to this endpoint on failures or critical events.
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Daily Summary Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Daily digest of workflow stats (runs, errors, successes).
                    </p>
                  </div>
                  <Button
                    variant={notificationSettings.dailySummary ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNotificationSettings({...notificationSettings, dailySummary: !notificationSettings.dailySummary})}
                  >
                    {notificationSettings.dailySummary ? "On" : "Off"}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button>Save Notification Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About & Support Tab */}
        <TabsContent value="about" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* System Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Version</span>
                    <span className="text-sm text-muted-foreground">Rune v0.3.1 (MVP)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Environment</span>
                    <Badge variant="secondary">Production</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">System Status</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-muted-foreground">Operational</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Uptime</span>
                    <span className="text-sm text-muted-foreground">99.9% (30 days)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View System Analytics
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Export System Logs
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  Security Audit
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Support & Resources */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Support & Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <Button variant="outline" className="justify-start" asChild>
                  <a href="https://docs.rune.app" target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" />
                    Documentation
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>
                
                <Button variant="outline" className="justify-start" asChild>
                  <a href="https://discord.gg/rune" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Community Forum
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>

                <Button variant="outline" className="justify-start">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Support
                </Button>

                <Button variant="outline" className="justify-start" asChild>
                  <a href="https://github.com/rune-org/rune/issues" target="_blank" rel="noopener noreferrer">
                    <Bug className="h-4 w-4 mr-2" />
                    Report a Bug
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>

                <Button variant="outline" className="justify-start" asChild>
                  <a href="https://rune.app/terms" target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" />
                    Terms & Privacy
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>

                <Button variant="outline" className="justify-start" asChild>
                  <a href="https://status.rune.app" target="_blank" rel="noopener noreferrer">
                    <Globe className="h-4 w-4 mr-2" />
                    System Status
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Container>
  );
}