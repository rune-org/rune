"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { WaitData } from "../types";

export const WaitNode = memo(function WaitNode({
  id,
  data,
}: NodeProps<Node<WaitData>>) {
  const amount = data.amount ?? 1;
  const unit = data.unit ?? "seconds";

  return (
    <BaseNode
      nodeId={id}
      icon={<Clock className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Wait"}
      bgClassName="bg-node-core-bg"
      borderColor="--node-core-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">
        Wait {amount} {unit}
      </div>
    </BaseNode>
  );
});
