"use client";

import { memo, useEffect, useState } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { useNodeExecution } from "../context/ExecutionContext";
import type { WaitData } from "../types";

export const WaitNode = memo(function WaitNode({ id, data }: NodeProps<Node<WaitData>>) {
  const amount = data.amount ?? 1;
  const unit = data.unit ?? "seconds";

  const execution = useNodeExecution(id);
  const resumeAt = extractResumeAt(execution?.output);
  const isWaiting = execution?.status === "waiting" && resumeAt !== null;

  return (
    <BaseNode
      nodeId={id}
      icon={<Clock className="h-4 w-4 text-muted-foreground" />}
      label={data.label ?? "Wait"}
      bgClassName="bg-node-flow-bg"
      borderColor="--node-flow-border"
      pinned={data.pinned}
    >
      {isWaiting ? (
        <WaitCountdown resumeAt={resumeAt} />
      ) : (
        <div className="text-xs text-muted-foreground">
          Wait {amount} {unit}
        </div>
      )}
    </BaseNode>
  );
});

function WaitCountdown({ resumeAt }: { resumeAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, resumeAt - now);
  const label = remainingMs === 0 ? "Resuming…" : `Resumes in ${formatRemaining(remainingMs)}`;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500 tabular-nums">
      <Clock className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}

function extractResumeAt(output: unknown): number | null {
  if (!output || typeof output !== "object") return null;
  const value = (output as Record<string, unknown>).resume_at;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
