"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { GitBranch, Pin } from "lucide-react";
import type { IfData } from "../types";

export const IfNode = memo(function IfNode({ data }: NodeProps<Node<IfData>>) {
  return (
    <div
      className="rune-node relative w-[200px] rounded-[var(--radius)] border-2 bg-node-core-bg p-3 text-sm text-foreground shadow-sm"
      style={{ borderColor: 'var(--node-core-border)' }}
    >
      {data.pinned && (
        <div
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ring text-background shadow-sm"
          title="Pinned - position locked during auto-layout"
        >
          <Pin className="h-3 w-3" />
        </div>
      )}
      <div className="flex items-center gap-2 font-medium">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        {data.label ?? "If"}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        {data.expression ?? "expression"}
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
});
