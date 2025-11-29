"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Play, Pin } from "lucide-react";
import type { TriggerData } from "../types";

export const TriggerNode = memo(function TriggerNode({ data }: NodeProps<Node<TriggerData>>) {
  return (
    <div
      className="rune-node relative w-[160px] rounded-[var(--radius)] border-2 bg-node-trigger-bg p-2 text-sm"
      style={{ borderColor: 'var(--node-trigger-border)' }}
    >
      {data.pinned && (
        <div
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ring text-background shadow-sm"
          title="Pinned - position locked during auto-layout"
        >
          <Pin className="h-3 w-3" />
        </div>
      )}
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Play className="h-4 w-4 text-muted-foreground" />
        {data.label ?? "Trigger"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
});
