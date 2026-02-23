"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Settings as SettingsIcon, 
  Bell, 
  Info
} from "lucide-react";
import { GeneralTab } from "@/components/admin/GeneralTab";
import { SecurityTab } from "@/components/admin/SecurityTab";
import { NotificationsTab } from "@/components/admin/NotificationsTab";
import { AboutSupportTab } from "@/components/admin/AboutSupportTab";
import { toast } from "@/components/ui/toast";

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

  // Mock users data for the users tab (will be replaced with real API calls in the future)
  const mockUsers = [
    { id: 1, name: "Admin User", email: "admin@rune.com", role: "Admin", status: "Active" },
    { id: 2, name: "Demo User", email: "user@rune.com", role: "User", status: "Active" },
  ];

  const handleSaveGeneralSettings = () => {
    // TODO: Implement API call to save general settings
    toast.success("General settings saved");
  };

  const handleSaveNotificationSettings = () => {
    // TODO: Implement API call to save notification settings
    toast.success("Notification settings saved");
  };

  const handleInviteUser = () => {
    // TODO: Implement API call to invite user
    toast.success("User invited");
    setIsInviteOpen(false);
    setInviteEmail("");
    setInviteRole("User");
  };

  const handleRemoveUser = (userId: number) => {
    // TODO: Implement API call to remove user
    toast.success("User removed");
  };

  const handleRoleChange = (userId: number, newRole: string) => {
    // TODO: Implement API call to change user role
    toast.success("User role updated");
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
          <GeneralTab 
            settings={generalSettings}
            onSettingsChange={setGeneralSettings}
            onSave={handleSaveGeneralSettings}
          />
        </TabsContent>

        {/* Users & Permissions Tab */}
        <TabsContent value="users" className="space-y-6">
          <SecurityTab
            users={mockUsers}
            onRoleChange={handleRoleChange}
            onRemoveUser={handleRemoveUser}
            onInviteUser={handleInviteUser}
            isInviteOpen={isInviteOpen}
            setIsInviteOpen={setIsInviteOpen}
            inviteEmail={inviteEmail}
            setInviteEmail={setInviteEmail}
            inviteRole={inviteRole}
            setInviteRole={setInviteRole}
          />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <NotificationsTab
            settings={notificationSettings}
            onSettingsChange={setNotificationSettings}
            onSave={handleSaveNotificationSettings}
          />
        </TabsContent>

        {/* About & Support Tab */}
        <TabsContent value="about" className="space-y-6">
          <AboutSupportTab />
        </TabsContent>
      </Tabs>
    </Container>
  );
}
