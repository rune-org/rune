"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Pencil } from "lucide-react";
import { BaseNode } from "@/features/canvas/nodes/BaseNode";
import { useMarketingDemo } from "./marketingDemoContext";

export const MarketingEditNode = memo(function MarketingEditNode({ id }: NodeProps) {
  const { amount, setAmount, running } = useMarketingDemo();

  return (
    <BaseNode
      nodeId={id}
      icon={<Pencil className="h-4 w-4 text-muted-foreground" />}
      label="Define Payload"
      bgClassName="bg-node-transform-bg"
      borderColor="--node-transform-border"
    >
      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-mono">amount</span>
        <input
          type="number"
          value={amount}
          disabled={running}
          onChange={(e) => setAmount(Number(e.target.value))}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="nodrag nopan w-24 rounded-md border border-border bg-background px-2 py-1 text-right text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
        />
      </label>
    </BaseNode>
  );
});
