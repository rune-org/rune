"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Pencil } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { EditData } from "../types";

export const EditNode = memo(function EditNode({
  data,
}: NodeProps<Node<EditData>>) {
  const assignments = data.assignments ?? [];
  const mode = data.mode ?? "assignments";

  return (
    <BaseNode
      icon={<Pencil className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Edit"}
      bgClassName="bg-node-core-bg"
      borderColor="--node-core-border"
      pinned={data.pinned}
    >
      <div className="text-xs text-muted-foreground">
        {mode === "keep_only"
          ? `Keep ${assignments.length} field(s)`
          : `${assignments.length} assignment(s)`}
      </div>
    </BaseNode>
  );
});
