"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Info, 
  MessageCircle, 
  Bug, 
  FileText, 
  Zap, 
  BarChart3,
  Mail,
  Globe,
  ExternalLink,
  Shield
} from "lucide-react";

export function AboutSupportTab() {
  return (
    <div className="space-y-6">
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
    </div>
  );
}
