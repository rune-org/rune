"use client";

// TODO: Implement admin settings tabs once backend API endpoints are available.
// All tab content is currently placeholder

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings as SettingsIcon,
  Bell,
  Info
} from "lucide-react";

export default function AdminPage() {
  const [selectedTab, setSelectedTab] = useState("general");

  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Admin Settings"
        description="Manage workspace settings and system configuration."
      />

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
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

        <TabsContent value="general" className="space-y-6">
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <SettingsIcon className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">General Settings</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Workspace name, branding, and configuration options will appear here.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Notifications & Alerts</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Notification preferences and alert thresholds will be configurable here.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="about" className="space-y-6">
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <Info className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">About & Support</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              System information, resources, and support links will appear here.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </Container>
  );
}
