"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Layers } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { AggregatorData } from "../types";

export const AggregatorNode = memo(function AggregatorNode({
  id,
  data,
}: NodeProps<Node<AggregatorData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<Layers className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Aggregator"}
      bgClassName="bg-node-core-bg"
      borderColor="--node-core-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">
        Collects split results
      </div>
    </BaseNode>
  );
});
