"use client";

import { Handle, Position } from "@xyflow/react";
import { Bot } from "lucide-react";

export function AgentNode({ data }: { data: { label?: string } }) {
  return (
    <div className="rune-node min-w-[200px] rounded-[var(--radius)] border border-border/70 bg-card p-3 text-sm text-foreground shadow-sm">
      <div className="flex items-center gap-2 font-medium">
        <Bot className="h-4 w-4 text-muted-foreground" />
        {data?.label ?? "Agent"}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Model • Tools • Limits
      </div>
      <Handle type="target" position={Position.Left} className="!bg-ring" />
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
}
