"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Split } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { SplitData } from "../types";

export const SplitNode = memo(function SplitNode({
  id,
  data,
}: NodeProps<Node<SplitData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<Split className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Split"}
      bgClassName="bg-node-transform-bg"
      borderColor="--node-transform-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">
        {data.array_field ? `Split: ${data.array_field}` : "Configure array field"}
      </div>
    </BaseNode>
  );
});
