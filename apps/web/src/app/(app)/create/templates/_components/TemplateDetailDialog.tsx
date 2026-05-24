"use client";

import { ArrowRight, Box, ExternalLink, Sparkles, Tag, User2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { resolveTemplateIcon } from "@/lib/templateIcons";
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

const SCOPE_TONE: Record<string, string> = {
  official: "bg-primary/15 text-primary border-primary/30",
  community: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-300",
  personal: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
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

const CATEGORY_TONE: Record<string, string> = {
  general: "from-slate-500/25 via-slate-500/10 to-transparent",
  email: "from-sky-500/30 via-sky-500/10 to-transparent",
  analytics: "from-violet-500/30 via-violet-500/10 to-transparent",
  development: "from-emerald-500/30 via-emerald-500/10 to-transparent",
  cloud: "from-cyan-500/30 via-cyan-500/10 to-transparent",
  scheduling: "from-amber-500/30 via-amber-500/10 to-transparent",
  social_media: "from-pink-500/30 via-pink-500/10 to-transparent",
  productivity: "from-indigo-500/30 via-indigo-500/10 to-transparent",
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
  const scopeTone = SCOPE_TONE[scope] ?? SCOPE_TONE.community;
  const categoryLabel = CATEGORY_LABELS[template.category] ?? template.category;
  const categoryTone = CATEGORY_TONE[template.category] ?? CATEGORY_TONE.general;
  const tags = template.tags ?? [];
  const nodeCount = template.node_count ?? 0;
  const usage = template.usage_count ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <div
          className={cn(
            "relative h-40 overflow-hidden bg-gradient-to-br",
            categoryTone,
          )}
        >
          <Icon
            aria-hidden
            strokeWidth={1.5}
            className="pointer-events-none absolute left-2 -bottom-5 h-50 w-50 text-foreground opacity-60"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, black 20%, transparent 95%)",
              maskImage: "linear-gradient(to right, black 20%, transparent 95%)",
            }}
          />
          <div className="absolute bottom-4 right-6 flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border bg-background/80 text-[11px] backdrop-blur-md",
                scopeTone,
              )}
            >
              {scope === "official" && <Sparkles className="mr-1 h-3 w-3" />}
              {scopeLabel}
            </Badge>
            <Badge
              variant="secondary"
              className="bg-background/80 text-[11px] backdrop-blur-md"
            >
              {categoryLabel}
            </Badge>
          </div>
          <div className="absolute inset-y-0 right-0 flex w-[68%] flex-col justify-center pl-6 pr-6 pb-10">
            <DialogTitle className="font-display text-[2.2rem] font-semibold leading-[1.15] tracking-tight">
              {template.name}
            </DialogTitle>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
          <DialogDescription className="text-sm leading-relaxed text-foreground/80">
            {template.description || "No description provided."}
          </DialogDescription>

          <div className="grid grid-cols-3 gap-3">
            <Stat icon={<Box className="h-3.5 w-3.5" />} label="Nodes" value={nodeCount} />
            <Stat
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label="Uses"
              value={usage}
            />
            <Stat
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Tags"
              value={tags.length}
            />
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {template.author_name && (
            <div className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
              <User2 className="h-3.5 w-3.5" />
              <span>By {template.author_name}</span>
              {template.author_url && (
                <a
                  href={template.author_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => onUse(template)} className="gap-1.5">
              Use this template
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}
