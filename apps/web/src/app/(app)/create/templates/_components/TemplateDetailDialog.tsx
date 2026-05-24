"use client";

import { ArrowRight, ExternalLink, User2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveTemplateIcon } from "./templateIcons";
import type { TemplateSummary } from "@/client/types.gen";

type TemplateDetailDialogProps = {
  template: TemplateSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: (template: TemplateSummary) => void;
};

const SCOPE_LABELS: Record<string, string> = {
  official: "Official",
  community: "Community",
  personal: "Personal",
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  email: "Email",
  analytics: "Analytics",
  development: "Development",
  cloud: "Cloud",
  scheduling: "Scheduling",
  social_media: "Social media",
  productivity: "Productivity",
};

export function TemplateDetailDialog({
  template,
  open,
  onOpenChange,
  onUse,
}: TemplateDetailDialogProps) {
  if (!template) return null;

  const Icon = resolveTemplateIcon({ icon: template.icon, category: template.category });
  const scope = template.scope as string;
  const scopeLabel = SCOPE_LABELS[scope] ?? scope;
  const categoryLabel = CATEGORY_LABELS[template.category] ?? template.category;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-muted p-2 text-muted-foreground">
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">{template.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {template.description || "No description provided."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={scope === "official" ? "default" : "outline"}>
              {scopeLabel}
            </Badge>
            <Badge variant="secondary">{categoryLabel}</Badge>
            <span className="text-xs text-muted-foreground">
              {template.usage_count > 0
                ? `Used ${template.usage_count} time${template.usage_count === 1 ? "" : "s"}`
                : "New"}
            </span>
          </div>

          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {template.author_name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User2 className="h-3.5 w-3.5" />
              <span>By {template.author_name}</span>
              {template.author_url && (
                <a
                  href={template.author_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onUse(template)} className="gap-1">
            Use this template
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
