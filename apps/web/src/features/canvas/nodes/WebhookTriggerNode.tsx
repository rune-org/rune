"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Pin, Webhook } from "lucide-react";
import { useNodeExecution } from "../context/ExecutionContext";
import { StatusIndicator } from "./StatusIndicator";
import type { WebhookTriggerData } from "../types";
import { cn } from "@/lib/cn";

export const WebhookTriggerNode = memo(function WebhookTriggerNode({
  id,
  data,
}: NodeProps<Node<WebhookTriggerData>>) {
  const nodeExecution = useNodeExecution(id);
  const executionStatus = nodeExecution?.status ?? "idle";

  return (
    <div
      className={cn(
        "rune-node relative w-[160px] max-w-[160px] rounded-[var(--radius)] border-2 bg-node-trigger-bg p-2 text-sm transition-[border-color,box-shadow,background-color] duration-200",
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
            className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ring text-background shadow-sm"
            title="Pinned - position locked during auto-layout"
          >
            <Pin className="h-3 w-3" />
          </div>
        )
      )}
      <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
        <Webhook className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{data.label ?? "Webhook"}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
});
