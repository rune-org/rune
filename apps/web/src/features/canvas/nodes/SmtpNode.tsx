"use client";

import { type Node, type NodeProps } from "@xyflow/react";
import { Mail } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { SmtpData } from "../types";

export function SmtpNode({ data }: NodeProps<Node<SmtpData>>) {
  return (
    <BaseNode
      icon={<Mail className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "SMTP"}
    >
      <div className="truncate text-xs text-muted-foreground">
        To: {data.to ?? "user@example.com"}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        Subj: {data.subject ?? "Hello from Rune"}
      </div>
    </BaseNode>
  );
}
