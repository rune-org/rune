"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Logs } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { LogData } from "../types";

export const LogNode = memo(function LogNode({ id, data }: NodeProps<Node<LogData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<Logs className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Log"}
      bgClassName="bg-node-flow-bg"
      borderColor="--node-flow-border"
      pinned={data.pinned}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{data.message?.trim() || "No message yet"}</span>
        <span className="rounded bg-muted/40 px-2 py-0.5 uppercase">{data.level ?? "info"}</span>
      </div>
    </BaseNode>
  );
});
