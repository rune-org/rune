"use client";

import { Handle, Position } from "@xyflow/react";
import { Play } from "lucide-react";

export function TriggerNode({ data }: { data: { label?: string } }) {
  return (
    <div className="rune-node min-w-[120px] rounded-[var(--radius)] border border-border/70 bg-primary/10 p-2 text-sm">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Play className="h-4 w-4 text-muted-foreground" />
        {data?.label ?? "Trigger"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
}
