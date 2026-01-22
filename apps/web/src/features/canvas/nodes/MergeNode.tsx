"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Combine } from "lucide-react";
import type { MergeData } from "../types";
import { BaseNode } from "./BaseNode";

export const MergeNode = memo(function MergeNode({
  id,
  data,
}: NodeProps<Node<MergeData>>) {
  const waitMode = data.wait_mode ?? "wait_for_all";
  const timeout = data.timeout ?? 300;

  return (
    <BaseNode
      nodeId={id}
      icon={<Combine className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Merge"}
      bgClassName="bg-node-flow-bg"
      borderColor="--node-flow-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">
        {waitMode === "wait_for_all" ? "Wait for all" : "Wait for any"}
      </div>
      <div className="text-xs text-muted-foreground">Timeout: {timeout}s</div>
    </BaseNode>
  );
});
