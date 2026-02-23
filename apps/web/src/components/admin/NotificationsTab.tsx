"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell } from "lucide-react";

interface NotificationSettings {
  emailNotifications: boolean;
  alertRecipients: string[];
  errorThreshold: number;
  workflowLevelAlerts: boolean;
  webhookUrl: string;
  dailySummary: boolean;
}

interface NotificationsTabProps {
  settings: NotificationSettings;
  onSettingsChange: (settings: NotificationSettings) => void;
  onSave: () => void;
}

export function NotificationsTab({ settings, onSettingsChange, onSave }: NotificationsTabProps) {
  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
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
              variant={settings.emailNotifications ? "default" : "outline"}
              size="sm"
              onClick={() => updateSetting("emailNotifications", !settings.emailNotifications)}
            >
              {settings.emailNotifications ? "On" : "Off"}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Alert Recipients</Label>
            <Select 
              value={settings.alertRecipients[0]} 
              onValueChange={(value) => updateSetting("alertRecipients", [value])}
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
              value={settings.errorThreshold}
              onChange={(e) => updateSetting("errorThreshold", parseInt(e.target.value))}
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
              variant={settings.workflowLevelAlerts ? "default" : "outline"}
              size="sm"
              onClick={() => updateSetting("workflowLevelAlerts", !settings.workflowLevelAlerts)}
            >
              {settings.workflowLevelAlerts ? "Enabled" : "Disabled"}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook Notifications</Label>
            <Input
              id="webhook-url"
              value={settings.webhookUrl}
              onChange={(e) => updateSetting("webhookUrl", e.target.value)}
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
              variant={settings.dailySummary ? "default" : "outline"}
              size="sm"
              onClick={() => updateSetting("dailySummary", !settings.dailySummary)}
            >
              {settings.dailySummary ? "On" : "Off"}
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave}>Save Notification Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
}
