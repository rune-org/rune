"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import type { SwitchData, SwitchRule } from "../types";
import {
  switchFallbackHandleId,
  switchHandleLabelFromId,
  switchRuleHandleId,
} from "../utils/switchHandles";

function describeRule(rule: SwitchRule): string {
  const lhs = rule.value?.trim() || "$input.field";
  const op = rule.operator || "==";
  const rhs = rule.compare?.trim() || "value";
  return `${lhs} ${op} ${rhs}`;
}

export const SwitchNode = memo(function SwitchNode({
  data,
}: NodeProps<Node<SwitchData>>) {
  const rules = useMemo(() => Array.isArray(data.rules) ? data.rules : [], [data.rules]);
  const handleLayout = useMemo(() => {
    const baseTop = 64;
    const spacing = 64;
    const ruleHandles = rules.map((_, idx) => ({
      id: switchRuleHandleId(idx),
      label: switchHandleLabelFromId(switchRuleHandleId(idx)) ?? `case ${idx + 1}`,
      top: baseTop + idx * spacing,
    }));
    const fallbackHandle = {
      id: switchFallbackHandleId(),
      label: switchHandleLabelFromId(switchFallbackHandleId()) ?? "fallback",
      top: baseTop + rules.length * spacing,
    };
    return [...ruleHandles, fallbackHandle];
  }, [rules]);

  return (
    <div
      className="rune-node relative w-[240px] rounded-[var(--radius)] border-2 bg-node-core-bg p-3 text-sm text-foreground shadow-sm"
      style={{ borderColor: "var(--node-core-border)" }}
    >
      <div className="flex items-center justify-between gap-2 font-medium">
        <div className="flex items-center gap-2 truncate">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{data.label ?? "Switch"}</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {rules.length} {rules.length == 1 ? 'route' : 'routes'}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {rules.length > 0 ? (
          rules.map((rule, idx) => (
            <div
              key={idx}
              className="relative rounded-[calc(var(--radius)-0.35rem)] border border-border/60 bg-background/60 px-3 py-2"
            >
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                {switchHandleLabelFromId(switchRuleHandleId(idx)) ?? `case ${idx + 1}`}
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {describeRule(rule)}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[calc(var(--radius)-0.35rem)] border border-dashed border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            No rules configured. Add rules in the inspector to route traffic.
          </div>
        )}
        <div className="relative rounded-[calc(var(--radius)-0.35rem)] border border-dashed border-border/60 bg-muted/40 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">
            {switchHandleLabelFromId(switchFallbackHandleId()) ?? "fallback"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Used when no rules match.
          </div>
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-ring" />
      {handleLayout.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={Position.Right}
          className="!bg-ring"
          style={{ top: h.top }}
        />
      ))}
    </div>
  );
});
