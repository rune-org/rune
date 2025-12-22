"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { GitBranch, Pin, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { useNodeExecution } from "../context/ExecutionContext";
import type { NodeExecutionStatus } from "../types/execution";
import type { IfData } from "../types";
import { cn } from "@/lib/cn";

function StatusIndicator({ status }: { status: NodeExecutionStatus }) {
  switch (status) {
    case "running":
      return (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-md z-10" title="Running">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      );
    case "success":
      return (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white shadow-md z-10" title="Success">
          <CheckCircle className="h-3.5 w-3.5" />
        </div>
      );
    case "failed":
      return (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md z-10" title="Failed">
          <XCircle className="h-3.5 w-3.5" />
        </div>
      );
    case "waiting":
      return (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-white shadow-md z-10" title="Waiting">
          <Clock className="h-3.5 w-3.5" />
        </div>
      );
    default:
      return null;
  }
}

export const IfNode = memo(function IfNode({ id, data }: NodeProps<Node<IfData>>) {
  const nodeExecution = useNodeExecution(id);
  const executionStatus = nodeExecution?.status ?? "idle";

  return (
    <div
      className={cn(
        "rune-node relative w-[200px] rounded-[var(--radius)] border-2 bg-node-core-bg p-3 text-sm text-foreground shadow-sm transition-all duration-300",
        executionStatus !== "idle" && executionStatus,
        executionStatus === "running" && "animate-pulse-subtle"
      )}
      style={executionStatus === "idle" ? { borderColor: 'var(--node-core-border)' } : undefined}
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
