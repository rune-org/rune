"use client";

import { Handle, Position } from "@xyflow/react";
import { Mail } from "lucide-react";

type SmtpData = {
  label?: string;
  to?: string;
  subject?: string;
};

export function SmtpNode({ data }: { data: SmtpData }) {
  return (
    <div className="rune-node min-w-[220px] rounded-[var(--radius)] border border-border/70 bg-card p-3 text-sm text-foreground shadow-sm">
      <div className="flex items-center gap-2 font-medium">
        <Mail className="h-4 w-4 text-muted-foreground" />
        {data?.label ?? "SMTP"}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">
        To: {data?.to ?? "user@example.com"}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        Subj: {data?.subject ?? "Hello from Rune"}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-ring" />
      <Handle type="source" position={Position.Right} className="!bg-ring" />
    </div>
  );
}
