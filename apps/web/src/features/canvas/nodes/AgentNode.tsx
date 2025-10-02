"use client";

import { Handle, Position } from "@xyflow/react";

export function AgentNode({ data }: { data: { label?: string } }) {
  return (
    <div className="min-w-[200px] rounded-[var(--radius)] border border-border/70 bg-card p-3 text-sm text-foreground shadow-sm">
      <div className="font-medium">{data?.label ?? "Agent"}</div>
      <div className="mt-2 text-xs text-muted-foreground">
        Model • Tools • Limits
      </div>
      <Handle type="target" position={Position.Left} className="!bg-ring" />
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
}
