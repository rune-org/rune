"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import type { TriggerData } from "../types";

export function TriggerNode({ data }: NodeProps<Node<TriggerData>>) {
  return (
    <div
      className="rune-node min-w-[120px] rounded-[var(--radius)] border-2 bg-node-trigger-bg p-2 text-sm"
      style={{ borderColor: 'var(--node-trigger-border)' }}
    >
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Play className="h-4 w-4 text-muted-foreground" />
        {data.label ?? "Trigger"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
}
