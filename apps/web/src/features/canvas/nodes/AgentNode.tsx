"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { AgentData } from "../types";

export const AgentNode = memo(function AgentNode({ id, data }: NodeProps<Node<AgentData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<Bot className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Agent"}
      bgClassName="bg-node-agent-bg"
      borderColor="--node-agent-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">
        Model • Tools • Limits
      </div>
    </BaseNode>
  );
});
