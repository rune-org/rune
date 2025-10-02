"use client";

import { Handle, Position } from "@xyflow/react";

export function TriggerNode({ data }: { data: { label?: string } }) {
  return (
    <div className="min-w-[120px] rounded-[var(--radius)] border border-border/70 bg-primary/10 p-2 text-sm">
      <div className="font-medium text-foreground">
        {data?.label ?? "Trigger"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
}
