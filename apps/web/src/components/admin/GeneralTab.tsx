"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Upload } from "lucide-react";

interface GeneralSettings {
  workspaceName: string;
  workspaceLogo: null;
  baseUrl: string;
  timezone: string;
  locale: string;
}

interface GeneralTabProps {
  settings: GeneralSettings;
  onSettingsChange: (settings: GeneralSettings) => void;
  onSave: () => void;
}

export function GeneralTab({ settings, onSettingsChange, onSave }: GeneralTabProps) {
  const updateSetting = (key: keyof GeneralSettings, value: string) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
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
              value={settings.workspaceName}
              onChange={(e) => updateSetting("workspaceName", e.target.value)}
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
              value={settings.baseUrl}
              onChange={(e) => updateSetting("baseUrl", e.target.value)}
              placeholder="https://your-workspace.rune.app"
            />
            <p className="text-xs text-muted-foreground">
              The public URL where workflows execute callbacks and integrations return data. Used for webhooks and OAuth redirects.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone">Default Time Zone</Label>
              <Select value={settings.timezone} onValueChange={(value) => updateSetting("timezone", value)}>
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
              <Select value={settings.locale} onValueChange={(value) => updateSetting("locale", value)}>
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
            <Button onClick={onSave}>Save Changes</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
