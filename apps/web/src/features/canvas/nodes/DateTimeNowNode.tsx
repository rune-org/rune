"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { CalendarClock } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { DateTimeNowData } from "../types";

export const DateTimeNowNode = memo(function DateTimeNowNode({
  id,
  data,
}: NodeProps<Node<DateTimeNowData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Current Date/Time"}
      bgClassName="bg-node-datetime-bg"
      borderColor="--node-datetime-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">Get current date/time</div>
      <div className="truncate text-[11px] text-muted-foreground/80">{data.timezone ?? "UTC"}</div>
    </BaseNode>
  );
});
