import { Handle, Position } from "@xyflow/react";
import { memo, useMemo, type ReactNode } from "react";
import { Pin, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { useNodeExecution } from "../context/ExecutionContext";
import type { NodeExecutionStatus } from "../types/execution";
import { cn } from "@/lib/cn";

type BaseNodeProps = {
  /** Node ID for execution state lookup */
  nodeId: string;
  icon: React.ReactNode;
  label: string;
  children?: ReactNode;
  bgClassName?: string;
  borderColor?: string;
  pinned?: boolean;
};

/**
 * Status indicator component for node execution state.
 */
function StatusIndicator({ status }: { status: NodeExecutionStatus }) {
  switch (status) {
    case "running":
      return (
        <div
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-md z-10"
          title="Running"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      );
    case "success":
      return (
        <div
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white shadow-md z-10"
          title="Success"
        >
          <CheckCircle className="h-3.5 w-3.5" />
        </div>
      );
    case "failed":
      return (
        <div
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md z-10"
          title="Failed"
        >
          <XCircle className="h-3.5 w-3.5" />
        </div>
      );
    case "waiting":
      return (
        <div
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-white shadow-md z-10"
          title="Waiting"
        >
          <Clock className="h-3.5 w-3.5" />
        </div>
      );
    default:
      return null;
  }
}

export const BaseNode = memo(function BaseNode({
  nodeId,
  icon,
  label,
  children,
  bgClassName = "bg-card",
  borderColor,
  pinned = false,
}: BaseNodeProps) {
  const nodeExecution = useNodeExecution(nodeId);
  const executionStatus = nodeExecution?.status ?? "idle";

  const borderStyle = useMemo(() => {
    if (borderColor && executionStatus === "idle") {
      return { borderColor: `var(${borderColor})`, borderWidth: "2px" };
    }
    return {};
  }, [borderColor, executionStatus]);

  return (
    <div
      className={cn(
        "rune-node relative w-[220px] rounded-[var(--radius)] border-2 p-3 text-sm text-foreground shadow-sm transition-all duration-300",
        bgClassName,
        executionStatus !== "idle" && executionStatus,
        executionStatus === "running" && "animate-pulse-subtle"
      )}
      style={borderStyle}
    >
      {executionStatus !== "idle" ? (
        <StatusIndicator status={executionStatus} />
      ) : (
        pinned && (
          <div
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ring text-background shadow-sm z-10"
            title="Pinned - position locked during auto-layout"
          >
            <Pin className="h-3 w-3" />
          </div>
        )
      )}

      <div className="flex items-center gap-2 font-medium">
        {icon}
        {label}
      </div>

      {children && <div className="mt-2 space-y-1">{children}</div>}

      <Handle type="target" position={Position.Left} className="!bg-ring" />
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
});
