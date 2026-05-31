"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { CalendarPlus } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { DateTimeAddData } from "../types";

export const DateTimeAddNode = memo(function DateTimeAddNode({
  id,
  data,
}: NodeProps<Node<DateTimeAddData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<CalendarPlus className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Add Date/Time"}
      bgClassName="bg-node-datetime-bg"
      borderColor="--node-datetime-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">{`Add ${data.amount ?? 0} ${data.unit ?? "days"}`}</div>
      <div className="truncate text-[11px] text-muted-foreground/80">{data.timezone ?? "UTC"}</div>
    </BaseNode>
  );
});
