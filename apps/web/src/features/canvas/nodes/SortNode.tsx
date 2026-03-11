"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { ListOrdered } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { SortData } from "../types";
import { normalizeListItemFieldPath } from "../utils/listFieldPaths";

function describeSort(data: SortData): string {
  const rule = data.rules?.[0];
  if (!rule) return "No sort rules configured";
  const field = normalizeListItemFieldPath(data.input_array, rule.field) || "field";
  return `${field} ${rule.direction || "asc"}`;
}

export const SortNode = memo(function SortNode({ id, data }: NodeProps<Node<SortData>>) {
  const ruleCount = data.rules?.length ?? 0;

  return (
    <BaseNode
      nodeId={id}
      icon={<ListOrdered className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Sort"}
      bgClassName="bg-node-transform-bg"
      borderColor="--node-transform-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">{describeSort(data)}</div>
      <div className="text-[11px] text-muted-foreground/80">
        {ruleCount} rule{ruleCount === 1 ? "" : "s"}
      </div>
    </BaseNode>
  );
});
