"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Globe } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { HttpData } from "../types";

export const HttpNode = memo(function HttpNode({ id, data }: NodeProps<Node<HttpData>>) {
  return (
    <BaseNode
      nodeId={id}
      icon={<Globe className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "HTTP"}
      bgClassName="bg-node-http-bg"
      borderColor="--node-http-border"
      pinned={data.pinned}
    >
      <div className="flex items-center justify-between">
        <span className="truncate text-xs text-muted-foreground">
          {data.url ?? "https://api.example.com"}
        </span>
        <span className="ml-2 rounded bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
          {(data.method ?? "GET").toUpperCase()}
        </span>
      </div>
    </BaseNode>
  );
});
