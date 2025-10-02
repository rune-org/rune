"use client";

import { Handle, Position } from "@xyflow/react";

export function IfNode({
  data,
}: {
  data: { label?: string; expression?: string };
}) {
  return (
    <div className="min-w-[180px] rounded-[var(--radius)] border border-border/70 bg-card p-3 text-sm text-foreground shadow-sm">
      <div className="font-medium">{data?.label ?? "If"}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {data?.expression ? data.expression : "expression"}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-ring" />
      <Handle
        id="true"
        type="source"
        position={Position.Right}
        className="!bg-ring translate-y-[-8px]"
      />
      <Handle
        id="false"
        type="source"
        position={Position.Right}
        className="!bg-ring translate-y-[8px]"
      />
    </div>
  );
}
