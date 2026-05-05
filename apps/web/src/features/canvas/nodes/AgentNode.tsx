"use client";

import { memo, useCallback, type ReactNode } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Bot, MessageSquare, Wrench, Plug } from "lucide-react";
import { BaseNode } from "./BaseNode";
import type { AgentData } from "../types";
import { agentTabStore } from "../stores/agentTabStore";

export const AgentNode = memo(function AgentNode({ id, data }: NodeProps<Node<AgentData>>) {
  const modelName = data.model?.name ?? "No model configured";
  const toolCount = data.tools?.length ?? 0;
  const mcpCount = data.mcp_servers?.length ?? 0;

  const handleBlockClick = useCallback(
    (tab: string) => {
      agentTabStore.request(id, tab);
    },
    [id],
  );

  return (
    <BaseNode
      nodeId={id}
      icon={<Bot className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Agent"}
      bgClassName="bg-node-agent-bg"
      borderColor="--node-agent-border"
      pinned={data.pinned}
      className="w-[260px] max-w-[260px]"
    >
      <div className="text-xs text-muted-foreground truncate">{modelName}</div>

      <div className="mt-2 border-t border-border/40" />

      <div className="mt-2 grid grid-cols-3 gap-1">
        <MiniBlock
          icon={<MessageSquare className="h-3 w-3" />}
          label="Prompt"
          tab="prompt"
          onClick={handleBlockClick}
        />
        <MiniBlock
          icon={<Wrench className="h-3 w-3" />}
          label="Tools"
          count={toolCount}
          tab="tools"
          onClick={handleBlockClick}
        />
        <MiniBlock
          icon={<Plug className="h-3 w-3" />}
          label="MCP"
          count={mcpCount}
          tab="mcp"
          onClick={handleBlockClick}
        />
      </div>
    </BaseNode>
  );
});

function MiniBlock({
  icon,
  label,
  count,
  tab,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  tab: string;
  onClick: (tab: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className="flex flex-col items-center gap-0.5 rounded border border-border/40 bg-muted/20 px-1 py-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer"
    >
      {icon}
      <span className="text-[10px] leading-none">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[9px] tabular-nums text-muted-foreground/70">({count})</span>
      )}
    </button>
  );
}
