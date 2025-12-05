"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Combine, Pin } from "lucide-react";
import type { MergeData } from "../types";

export const MergeNode = memo(function MergeNode({
  data,
}: NodeProps<Node<MergeData>>) {
  const waitMode = data.wait_mode ?? "wait_for_all";
  const timeout = data.timeout ?? 300;

  return (
    <div
      className="rune-node relative w-[200px] rounded-[var(--radius)] border-2 bg-node-core-bg p-3 text-sm text-foreground shadow-sm"
      style={{ borderColor: "var(--node-core-border)" }}
    >
      {data.pinned && (
        <div
          className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ring text-background shadow-sm"
          title="Pinned - position locked during auto-layout"
        >
          <Pin className="h-3 w-3" />
        </div>
      )}
      <div className="flex items-center gap-2 font-medium">
        <Combine className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{data.label ?? "Merge"}</span>
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div>{waitMode === "wait_for_all" ? "Wait for all" : "Wait for any"}</div>
        <div>Timeout: {timeout}s</div>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-ring" />
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
});
