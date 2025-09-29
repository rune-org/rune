import { ArrowUpRight, LayoutDashboard, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const actions = {
  scratch: {
    title: "Start from scratch",
    description: "Design a workflow using integrations, triggers, and agents.",
    icon: <ArrowUpRight className="h-6 w-6" />,
    cta: "New workflow",
  },
  template: {
    title: "Use a template",
    description: "Launch faster with curated templates for common automations.",
    icon: <LayoutDashboard className="h-6 w-6" />,
    cta: "Browse templates",
  },
  agent: {
    title: "Ask an agent",
    description:
      "Describe the outcome and Rune will assemble the flow for you.",
    icon: <Sparkles className="h-6 w-6" />,
    cta: "Talk to an agent",
  },
};

type ActionKey = keyof typeof actions;

type ActionVariant = "primary" | "secondary" | "accent";

const variantStyles: Record<ActionVariant, string> = {
  primary:
    "border-primary/40 bg-primary/20 text-primary shadow-[0_12px_32px_hsl(217_91%_60%/0.25)]",
  secondary: "border-secondary/40 bg-secondary/40",
  accent: "border-accent/40 bg-accent/20 text-accent",
};

interface ActionCardProps {
  id: ActionKey;
  variant?: ActionVariant;
}

export function ActionCard({ id, variant = "secondary" }: ActionCardProps) {
  const action = actions[id];

  if (!action) return null;

  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-6 border border-border/60 bg-card/70 p-6 transition-colors",
        variantStyles[variant],
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-background/40 text-current">
        {action.icon}
      </div>
      <div className="space-y-2 text-foreground">
        <CardTitle className="text-xl font-semibold capitalize">
          {action.title}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {action.description}
        </CardDescription>
      </div>
      <Button variant="ghost" className="mt-auto w-fit text-sm">
        {action.cta}
      </Button>
    </Card>
  );
}
