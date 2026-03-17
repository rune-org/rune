"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { SquareDashedBottom } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { LimitData } from "../types";

export const LimitNode = memo(function LimitNode({ id, data }: NodeProps<Node<LimitData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<SquareDashedBottom className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Limit"}
      bgClassName="bg-node-transform-bg"
      borderColor="--node-transform-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">Keep first {data.count ?? 10} items</div>
    </BaseNode>
  );
});
