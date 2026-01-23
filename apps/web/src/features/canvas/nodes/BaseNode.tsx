import { Handle, Position } from "@xyflow/react";
import { memo, useMemo, type ReactNode } from "react";
import { Pin } from "lucide-react";
import { useNodeExecution } from "../context/ExecutionContext";
import { StatusIndicator } from "./StatusIndicator";
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
