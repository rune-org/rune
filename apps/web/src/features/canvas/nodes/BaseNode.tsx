import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";

type BaseNodeProps = {
  icon: React.ReactNode;
  label: string;
  children?: ReactNode;
};

export function BaseNode({ icon, label, children }: BaseNodeProps) {
  return (
    <div className="rune-node min-w-[200px] rounded-[var(--radius)] border border-border/70 bg-card p-3 text-sm text-foreground shadow-sm">
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {label}
      </div>

      {children && <div className="mt-2 space-y-1">{children}</div>}

      <Handle type="target" position={Position.Left} className="!bg-ring" />
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
}
