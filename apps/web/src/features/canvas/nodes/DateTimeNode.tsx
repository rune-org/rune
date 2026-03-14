"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { CalendarClock } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { DateTimeData } from "../types";

function describeOperation(data: DateTimeData): string {
  const operation = data.operation ?? "now";
  switch (operation) {
    case "add":
      return `Add ${data.amount ?? 0} ${data.unit ?? "days"}`;
    case "subtract":
      return `Subtract ${data.amount ?? 0} ${data.unit ?? "days"}`;
    case "format":
      return "Format date";
    default:
      return "Get current time";
  }
}

export const DateTimeNode = memo(function DateTimeNode({
  id,
  data,
}: NodeProps<Node<DateTimeData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Date & Time"}
      bgClassName="bg-node-transform-bg"
      borderColor="--node-transform-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">{describeOperation(data)}</div>
      <div className="truncate text-[11px] text-muted-foreground/80">{data.timezone ?? "UTC"}</div>
    </BaseNode>
  );
});
