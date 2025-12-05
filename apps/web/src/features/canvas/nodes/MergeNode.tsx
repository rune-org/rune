"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Combine, Pin } from "lucide-react";
import type { MergeData } from "../types";
import {
  mergeBranchHandleId,
  mergeBranchLabelFromId,
} from "../utils/mergeHandles";

export const MergeNode = memo(function MergeNode({
  data,
}: NodeProps<Node<MergeData>>) {
  const waitMode = data.wait_mode ?? "wait_for_all";
  const timeout = data.timeout ?? 300;
  const branchCount = data.branch_count ?? 2;

  const handleLayout = useMemo(() => {
    const baseTop = 64;
    const spacing = 40;
    return Array.from({ length: branchCount }, (_, idx) => ({
      id: mergeBranchHandleId(idx),
      label: mergeBranchLabelFromId(mergeBranchHandleId(idx)) ?? `branch ${idx + 1}`,
      top: baseTop + idx * spacing,
    }));
  }, [branchCount]);

  const nodeHeight = Math.max(80, 48 + branchCount * 40);

  return (
    <div
      className="rune-node relative w-[200px] rounded-[var(--radius)] border-2 bg-node-core-bg p-3 text-sm text-foreground shadow-sm"
      style={{ borderColor: "var(--node-core-border)", minHeight: nodeHeight }}
    >
      {data.pinned && (
        <div
          className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ring text-background shadow-sm"
          title="Pinned - position locked during auto-layout"
        >
          <Pin className="h-3 w-3" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 font-medium">
        <div className="flex items-center gap-2 truncate">
          <Combine className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{data.label ?? "Merge"}</span>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {branchCount} in
        </span>
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div>{waitMode === "wait_for_all" ? "Wait for all" : "Wait for any"}</div>
        <div>Timeout: {timeout}s</div>
      </div>

      {handleLayout.map((h) => (
        <Handle
          key={`${h.id}-${branchCount}`}
          id={h.id}
          type="target"
          position={Position.Left}
          className="!bg-ring"
          style={{ top: h.top }}
        />
      ))}

      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
});
