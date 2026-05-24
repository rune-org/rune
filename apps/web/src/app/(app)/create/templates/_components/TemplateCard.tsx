"use client";

import { ArrowRight, Box, User2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { resolveTemplateIcon } from "@/lib/templateIcons";
import type { TemplateSummary } from "@/client/types.gen";

type TemplateCardProps = {
  template: TemplateSummary;
  onOpenDetail: (template: TemplateSummary) => void;
  onUse: (template: TemplateSummary) => void;
};

const SCOPE_LABELS: Record<string, string> = {
  official: "Official",
  community: "Community",
  personal: "Personal",
};

const SCOPE_TONE: Record<string, string> = {
  official: "bg-primary/15 text-primary border-primary/30 backdrop-blur-sm",
  community:
    "bg-blue-500/15 text-blue-600 border-blue-500/30 backdrop-blur-sm dark:text-blue-300",
  personal:
    "bg-amber-500/15 text-amber-700 border-amber-500/30 backdrop-blur-sm dark:text-amber-300",
};

const CATEGORY_TONE: Record<string, string> = {
  general: "from-slate-500/15 via-slate-500/5 to-transparent",
  email: "from-sky-500/20 via-sky-500/5 to-transparent",
  analytics: "from-violet-500/20 via-violet-500/5 to-transparent",
  development: "from-emerald-500/20 via-emerald-500/5 to-transparent",
  cloud: "from-cyan-500/20 via-cyan-500/5 to-transparent",
  scheduling: "from-amber-500/20 via-amber-500/5 to-transparent",
  social_media: "from-pink-500/20 via-pink-500/5 to-transparent",
  productivity: "from-indigo-500/20 via-indigo-500/5 to-transparent",
};

export function TemplateCard({ template, onOpenDetail, onUse }: TemplateCardProps) {
  const Icon = resolveTemplateIcon({ icon: template.icon, category: template.category });
  const scope = template.scope as string;
  const scopeLabel = SCOPE_LABELS[scope] ?? scope;
  const scopeTone = SCOPE_TONE[scope] ?? SCOPE_TONE.community;
  const categoryTone = CATEGORY_TONE[template.category] ?? CATEGORY_TONE.general;
  const tags = template.tags ?? [];
  const visibleTags = tags.slice(0, 3);
  const extraTags = tags.length - visibleTags.length;
  const nodeCount = template.node_count ?? 0;

  return (
    <Card
      onClick={() => onOpenDetail(template)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(template);
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "group relative cursor-pointer overflow-hidden p-0",
        "transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-accent/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div
        className={cn(
          "relative h-40 overflow-hidden bg-gradient-to-br",
          categoryTone,
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-4 bottom-1 h-36 w-36 text-foreground opacity-80",
            "transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105",
          )}
          strokeWidth={1.5}
        />
        <span
          className={cn(
            "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm",
          )}
        >
          <Box className="h-3 w-3" />
          {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
        </span>
        <Badge
          variant="outline"
          className={cn("absolute left-3 top-3 border text-[10px]", scopeTone)}
        >
          {scopeLabel}
        </Badge>
        <div className="absolute inset-y-0 right-0 flex w-[55%] flex-col justify-center px-5">
          <div className="font-display line-clamp-3 text-[1.7rem] font-semibold leading-[1.1] tracking-tight text-foreground">
            {template.name}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="line-clamp-2 text-xs text-muted-foreground">
          {template.description || "No description provided."}
        </div>

        {(visibleTags.length > 0 || template.author_name) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
            {extraTags > 0 && (
              <span className="text-[10px] text-muted-foreground">+{extraTags} more</span>
            )}
            {template.author_name && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <User2 className="h-3 w-3" />
                {template.author_name}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {template.usage_count > 0
              ? `Used ${template.usage_count} time${template.usage_count === 1 ? "" : "s"}`
              : "New"}
          </span>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onUse(template);
            }}
            className="gap-1"
          >
            Use
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
