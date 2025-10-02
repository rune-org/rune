"use client";

import { Bot, GitBranch, Globe, Mail, Play } from "lucide-react";
import type { NodeKind } from "../types";

type LibraryProps = {
  onAdd: (type: NodeKind) => void;
};

export function LibraryGroups({ onAdd }: LibraryProps) {
  const Group = ({
    title,
    icon: Icon,
    items,
  }: {
    title: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    items: { label: string; type: NodeKind }[];
  }) => (
    <details
      open
      className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
    >
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </summary>
      <div className="mt-2 grid gap-2">
        {items.map((i) => (
          <button
            key={i.type}
            onClick={() => onAdd(i.type)}
            className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-background/60 px-3 py-1 text-left text-xs hover:bg-muted/40"
          >
            {i.label}
          </button>
        ))}
      </div>
    </details>
  );

  return (
    <div className="flex flex-col gap-3">
      <Group
        title="Triggers"
        icon={Play}
        items={[{ label: "Manual Trigger", type: "trigger" }]}
      />
      <Group
        title="Core"
        icon={GitBranch}
        items={[{ label: "If", type: "if" }]}
      />
      <Group
        title="HTTP"
        icon={Globe}
        items={[{ label: "HTTP Request", type: "http" }]}
      />
      <Group
        title="Email"
        icon={Mail}
        items={[{ label: "SMTP Email", type: "smtp" }]}
      />
      <Group
        title="Agents"
        icon={Bot}
        items={[{ label: "Agent", type: "agent" }]}
      />
    </div>
  );
}
