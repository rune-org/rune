import { Handle, Position } from "@xyflow/react";
import { memo, type ReactNode } from "react";

type BaseNodeProps = {
  icon: React.ReactNode;
  label: string;
  children?: ReactNode;
  bgClassName?: string;
  borderColor?: string;
};

export const BaseNode = memo(function BaseNode({ icon, label, children, bgClassName = "bg-card", borderColor }: BaseNodeProps) {
  const borderStyle = borderColor
    ? { borderColor: `var(${borderColor})`, borderWidth: '2px' }
    : {};

  return (
    <div
      className={`rune-node w-[220px] rounded-[var(--radius)] border-2 ${bgClassName} p-3 text-sm text-foreground shadow-sm`}
      style={borderStyle}
    >
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
