"use client";

import { Handle, Position } from "@xyflow/react";
import { Globe } from "lucide-react";

type HttpData = {
  label?: string;
  method?: string;
  url?: string;
};

export function HttpNode({ data }: { data: HttpData }) {
  return (
    <div className="rune-node min-w-[240px] rounded-[var(--radius)] border border-border/70 bg-card p-3 text-sm text-foreground shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Globe className="h-4 w-4 text-muted-foreground" />
          {data?.label ?? "HTTP"}
        </div>
        <span className="rounded bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
          {(data?.method ?? "GET").toUpperCase()}
        </span>
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {data?.url ?? "https://api.example.com"}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-ring" />
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
}
