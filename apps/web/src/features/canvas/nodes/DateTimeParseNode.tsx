"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { CalendarSearch } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { DateTimeParseData } from "../types";

export const DateTimeParseNode = memo(function DateTimeParseNode({
  id,
  data,
}: NodeProps<Node<DateTimeParseData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<CalendarSearch className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Parse Date/Time"}
      bgClassName="bg-node-datetime-bg"
      borderColor="--node-datetime-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">Parse into components</div>
      <div className="truncate text-[11px] text-muted-foreground/80">{data.timezone ?? "UTC"}</div>
    </BaseNode>
  );
});
