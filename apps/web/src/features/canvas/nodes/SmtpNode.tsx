"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Mail, Key, AlertCircle } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { SmtpData } from "../types";

export const SmtpNode = memo(function SmtpNode({ data }: NodeProps<Node<SmtpData>>) {
  const hasCredential = !!data.credential;

  return (
    <BaseNode
      icon={<Mail className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "SMTP"}
      bgClassName="bg-node-email-bg"
      borderColor="--node-email-border"
    >
      <div className="space-y-1">
        {hasCredential ? (
          <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Key className="h-3 w-3" />
            <span className="truncate">{data.credential?.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            <span className="truncate">No credential</span>
          </div>
        )}
        {data.from && (
          <div className="truncate text-xs text-muted-foreground">
            From: {data.from ?? "sender@example.com"}
          </div>
        )}
        <div className="truncate text-xs text-muted-foreground">
          To: {data.to ?? "recipient@example.com"}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          Subj: {data.subject ?? "Hello from Rune"}
        </div>
      </div>
    </BaseNode>
  );
});
