"use client";

import { memo } from "react";
import Image from "next/image";
import { type Node, type NodeProps } from "@xyflow/react";
import { Plug } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { IntegrationNodeData } from "../integrations/types";
import { getIntegrationTool } from "../integrations/helpers";

export const IntegrationNode = memo(function IntegrationNode({
  id,
  data,
}: NodeProps<Node<IntegrationNodeData>>) {
  const tool = getIntegrationTool(data.integrationKind);

  const previewField =
    tool?.argumentFields.find((f) => f.required && (f.type === "text" || f.type === "textarea")) ??
    null;
  const previewValue = previewField ? String(data.arguments?.[previewField.name] ?? "") : "";

  return (
    <BaseNode
      nodeId={id}
      icon={
        tool ? (
          <Image src={tool.icon} alt="" width={16} height={16} className="h-4 w-4" aria-hidden />
        ) : (
          <Plug className="h-4 w-4 text-muted-foreground" />
        )
      }
      label={data.label ?? tool?.label ?? "Integration"}
      bgColor={tool?.colorTheme.bg}
      borderColor={tool?.colorTheme.border}
      pinned={data.pinned}
    >
      <div className="space-y-0.5">
        <div className="truncate text-xs text-muted-foreground">
          {tool?.serviceLabel ?? "Integration"}
        </div>
        {previewField &&
          (previewValue ? (
            <div className="truncate text-xs text-foreground/60">{previewValue}</div>
          ) : (
            <div className="text-xs text-muted-foreground/40">Not configured</div>
          ))}
      </div>
    </BaseNode>
  );
});
