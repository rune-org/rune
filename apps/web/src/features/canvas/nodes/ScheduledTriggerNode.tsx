"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Clock, Pin } from "lucide-react";
import { useNodeExecution } from "../context/ExecutionContext";
import { StatusIndicator } from "./StatusIndicator";
import type { ScheduledTriggerData } from "../types";
import { cn } from "@/lib/cn";

export const ScheduledTriggerNode = memo(function ScheduledTriggerNode({
  id,
  data,
}: NodeProps<Node<ScheduledTriggerData>>) {
  const nodeExecution = useNodeExecution(id);
  const executionStatus = nodeExecution?.status ?? "idle";

  // Format the interval subtitle
  const interval = data.amount && data.unit ? `every ${data.amount} ${data.unit}` : null;

  return (
    <div
      className={cn(
        "rune-node relative w-[160px] rounded-[var(--radius)] border-2 bg-node-trigger-bg p-2 text-sm transition-[border-color,box-shadow,background-color] duration-200",
        executionStatus !== "idle" && executionStatus,
        executionStatus === "running" && "animate-pulse-subtle",
      )}
      style={executionStatus === "idle" ? { borderColor: "var(--node-trigger-border)" } : undefined}
    >
      {executionStatus !== "idle" ? (
        <StatusIndicator status={executionStatus} />
      ) : (
        data.pinned && (
          <div
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ring text-background shadow-sm z-10"
            title="Pinned - position locked during auto-layout"
          >
            <Pin className="h-3 w-3" />
          </div>
        )
      )}
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Clock className="h-4 w-4 text-muted-foreground" />
        {data.label ?? "Scheduled Trigger"}
      </div>
      {interval && <div className="text-xs text-muted-foreground mt-1">{interval}</div>}
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
});
