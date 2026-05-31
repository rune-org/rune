"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { CalendarCog } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { DateTimeFormatData } from "../types";

export const DateTimeFormatNode = memo(function DateTimeFormatNode({
  id,
  data,
}: NodeProps<Node<DateTimeFormatData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<CalendarCog className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Format Date/Time"}
      bgClassName="bg-node-datetime-bg"
      borderColor="--node-datetime-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">Format a date/time</div>
      <div className="truncate text-[11px] text-muted-foreground/80">{data.timezone ?? "UTC"}</div>
    </BaseNode>
  );
});
