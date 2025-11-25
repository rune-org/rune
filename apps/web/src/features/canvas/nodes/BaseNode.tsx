import { Handle, Position } from "@xyflow/react";
import { memo, type ReactNode } from "react";
import { Pin } from "lucide-react";

type BaseNodeProps = {
  icon: React.ReactNode;
  label: string;
  children?: ReactNode;
  bgClassName?: string;
  borderColor?: string;
  pinned?: boolean;
};

export const BaseNode = memo(function BaseNode({
  icon,
  label,
  children,
  bgClassName = "bg-card",
  borderColor,
  pinned = false,
}: BaseNodeProps) {
  const borderStyle = borderColor
    ? { borderColor: `var(${borderColor})`, borderWidth: '2px' }
    : {};

  return (
    <div
      className={`rune-node relative w-[220px] rounded-[var(--radius)] border-2 ${bgClassName} p-3 text-sm text-foreground shadow-sm`}
      style={borderStyle}
    >
      {pinned && (
        <div
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ring text-background shadow-sm"
          title="Pinned - position locked during auto-layout"
        >
          <Pin className="h-3 w-3" />
        </div>
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
