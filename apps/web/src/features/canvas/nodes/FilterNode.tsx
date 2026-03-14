"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Filter } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { FilterData } from "../types";
import { normalizeListItemFieldPath } from "../utils/listFieldPaths";

function describeRule(data: FilterData): string {
  const rule = data.rules?.[0];
  if (!rule) return "No rules configured";
  const field = normalizeListItemFieldPath(data.input_array, rule.field) || "field";
  return `${field} ${rule.operator || "=="} ${rule.value || "value"}`;
}

export const FilterNode = memo(function FilterNode({ id, data }: NodeProps<Node<FilterData>>) {
  const ruleCount = data.rules?.length ?? 0;

  return (
    <BaseNode
      nodeId={id}
      icon={<Filter className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Filter"}
      bgClassName="bg-node-transform-bg"
      borderColor="--node-transform-border"
      pinned={data.pinned}
    >
      <div className="truncate text-xs text-muted-foreground">{describeRule(data)}</div>
      <div className="text-[11px] text-muted-foreground/80">
        {data.match_mode === "any" ? "Match any rule" : "Match all rules"} • {ruleCount} rule
        {ruleCount === 1 ? "" : "s"}
      </div>
    </BaseNode>
  );
});
