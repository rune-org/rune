"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { CalendarMinus } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { DateTimeSubtractData } from "../types";

export const DateTimeSubtractNode = memo(function DateTimeSubtractNode({
  id,
  data,
}: NodeProps<Node<DateTimeSubtractData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<CalendarMinus className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Subtract Date/Time"}
      bgClassName="bg-node-datetime-bg"
      borderColor="--node-datetime-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">{`Subtract ${data.amount ?? 0} ${data.unit ?? "days"}`}</div>
      <div className="truncate text-[11px] text-muted-foreground/80">{data.timezone ?? "UTC"}</div>
    </BaseNode>
  );
});
