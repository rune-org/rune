"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Layers,
  ArrowDownWideNarrow,
  Search,
} from "lucide-react";
import type { ExecutionListItem, ExecutionListStatus } from "../types";
import { cn } from "@/lib/cn";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/formatTime";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";

type SortMode = "workflow" | "recent";

type ExecutionGroup = {
  workflowId: number;
  workflowName?: string;
  executions: ExecutionListItem[];
};

interface ExecutionsTableProps {
  executions: ExecutionListItem[];
  isLoading?: boolean;
}

function StatusBadge({ status }: { status: ExecutionListStatus }) {
  const configs: Record<
    ExecutionListStatus,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    pending: {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: "Pending",
      className: "bg-muted text-muted-foreground",
    },
    completed: {
      icon: <CheckCircle className="h-3.5 w-3.5" />,
      label: "Success",
      className: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    failed: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      label: "Failed",
      className: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    halted: {
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: "Halted",
      className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    },
  };

  const config = configs[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.className,
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function getGroupAccentDot(executions: ExecutionListItem[]): string {
  if (executions.some((e) => e.status === "failed")) return "bg-red-500";
  if (executions.some((e) => e.status === "halted")) return "bg-yellow-500";
  if (executions.some((e) => e.status === "pending")) return "bg-muted-foreground";
  return "bg-green-500";
}

function getStatusSummary(executions: ExecutionListItem[]): React.ReactNode {
  const counts: Partial<Record<ExecutionListStatus, number>> = {};
  for (const e of executions) {
    counts[e.status] = (counts[e.status] ?? 0) + 1;
  }

  const order: {
    status: ExecutionListStatus;
    label: string;
    className: string;
  }[] = [
    { status: "failed", label: "failed", className: "text-red-400" },
    { status: "halted", label: "halted", className: "text-yellow-400" },
    { status: "pending", label: "pending", className: "text-muted-foreground" },
    { status: "completed", label: "passed", className: "text-green-400" },
  ];

  const parts = order
    .filter((o) => (counts[o.status] ?? 0) > 0)
    .map((o) => (
      <span key={o.status} className={o.className}>
        {counts[o.status]} {o.label}
      </span>
    ));

  if (parts.length === 0) return null;

  return (
    <span className="hidden items-center gap-1 text-[11px] sm:flex">
      {parts.reduce<React.ReactNode[]>((acc, part, i) => {
        if (i > 0)
          acc.push(
            <span key={`sep-${i}`} className="text-muted-foreground/40">
              /
            </span>,
          );
        acc.push(part);
        return acc;
      }, [])}
    </span>
  );
}

// columns: ID | Status | Duration | Started | Completed = 5
const GROUPED_COL_COUNT = 5;

const colHeaderClass =
  "h-10 px-4 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70";

function TableHead({ mode }: { mode: SortMode }) {
  return (
    <thead>
      <tr className="border-b border-border/60">
        <th className={cn(colHeaderClass, "w-[120px]")}>ID</th>
        <th className={cn(colHeaderClass, "w-[180px]")}>
          {mode === "recent" ? "Workflow" : "Status"}
        </th>
        {mode === "recent" && <th className={cn(colHeaderClass, "w-[140px]")}>Status</th>}
        <th className={cn(colHeaderClass, "w-[90px]")}>Duration</th>
        <th className={cn(colHeaderClass, "w-[110px]")}>Started</th>
        <th className={cn(colHeaderClass, "w-[110px]")}>Completed</th>
      </tr>
    </thead>
  );
}

function ExecutionRow({
  execution,
  showWorkflow,
  isLast,
}: {
  execution: ExecutionListItem;
  showWorkflow: boolean;
  isLast: boolean;
}) {
  const workflowLabel = execution.workflowName || `Workflow #${execution.workflowId}`;

  return (
    <tr
      className={cn("transition-colors hover:bg-muted/20", !isLast && "border-b border-border/30")}
    >
      <td className="px-4 py-3">
        <Link
          href={`/create/app?workflow=${execution.workflowId}&execution=${execution.executionId}`}
          className="font-mono text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground/80 hover:underline"
        >
          {execution.executionId.slice(0, 8)}
        </Link>
      </td>

      {showWorkflow && (
        <td className="px-4 py-3">
          <Link
            href={`/create/app?workflow=${execution.workflowId}`}
            className="truncate text-sm text-foreground underline-offset-4 transition-colors hover:text-foreground/80 hover:underline"
          >
            {workflowLabel}
          </Link>
        </td>
      )}

      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <StatusBadge status={execution.status} />
          {execution.failureReason ? (
            <p
              className="max-w-[200px] truncate text-[11px] leading-tight text-muted-foreground/70"
              title={execution.failureReason}
            >
              {execution.failureReason}
            </p>
          ) : null}
        </div>
      </td>

      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
        {formatDuration(execution.durationMs)}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{formatRelativeTime(execution.startedAt)}</span>
          </TooltipTrigger>
          <TooltipContent>{formatAbsoluteTime(execution.startedAt)}</TooltipContent>
        </Tooltip>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {execution.completedAt ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{formatRelativeTime(execution.completedAt)}</span>
            </TooltipTrigger>
            <TooltipContent>{formatAbsoluteTime(execution.completedAt)}</TooltipContent>
          </Tooltip>
        ) : (
          "\u2014"
        )}
      </td>
    </tr>
  );
}

function GroupHeaderRow({
  group,
  isOpen,
  onToggle,
}: {
  group: ExecutionGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const dot = getGroupAccentDot(group.executions);
  const workflowLabel = group.workflowName || `Workflow #${group.workflowId}`;

  return (
    <tr
      className={cn(
        "border-b border-border/40 bg-muted/10 transition-colors hover:bg-muted/20",
        "cursor-pointer select-none",
      )}
      onClick={onToggle}
    >
      <td colSpan={GROUPED_COL_COUNT - 1} className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />

          <div className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />

          <Link
            href={`/create/app?workflow=${group.workflowId}`}
            className="truncate text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-foreground/80 hover:underline"
            title={workflowLabel}
            onClick={(e) => e.stopPropagation()}
          >
            {workflowLabel}
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {getStatusSummary(group.executions)}
          </div>
        </div>
      </td>

      <td className="px-4 py-2.5 text-right">
        <Badge variant="outline" className="tabular-nums">
          {group.executions.length}
        </Badge>
      </td>
    </tr>
  );
}

function GroupedBody({ groups }: { groups: ExecutionGroup[] }) {
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});

  return (
    <tbody>
      {groups.map((group, gi) => {
        const isOpen = openGroups[group.workflowId] ?? true;

        return (
          <React.Fragment key={group.workflowId}>
            <GroupHeaderRow
              group={group}
              isOpen={isOpen}
              onToggle={() =>
                setOpenGroups((prev) => ({
                  ...prev,
                  [group.workflowId]: !isOpen,
                }))
              }
            />

            {isOpen &&
              group.executions.map((execution, ei) => (
                <ExecutionRow
                  key={execution.executionId}
                  execution={execution}
                  showWorkflow={false}
                  isLast={ei === group.executions.length - 1 && gi === groups.length - 1}
                />
              ))}
          </React.Fragment>
        );
      })}
    </tbody>
  );
}

function RecentBody({ executions }: { executions: ExecutionListItem[] }) {
  const sorted = useMemo(
    () =>
      [...executions].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      ),
    [executions],
  );

  return (
    <tbody>
      {sorted.map((execution, i) => (
        <ExecutionRow
          key={execution.executionId}
          execution={execution}
          showWorkflow
          isLast={i === sorted.length - 1}
        />
      ))}
    </tbody>
  );
}

function SortToggle({ mode, onChange }: { mode: SortMode; onChange: (mode: SortMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg bg-muted/30 p-1 gap-0.5">
      <button
        type="button"
        onClick={() => onChange("workflow")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
          mode === "workflow"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Layers className="h-3.5 w-3.5" />
        Workflow
      </button>
      <button
        type="button"
        onClick={() => onChange("recent")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
          mode === "recent"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ArrowDownWideNarrow className="h-3.5 w-3.5" />
        Recent
      </button>
    </div>
  );
}

export function ExecutionsTable({ executions, isLoading }: ExecutionsTableProps) {
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === "undefined") return "workflow";
    const stored = localStorage.getItem("executions-sort-mode");
    return stored === "recent" ? "recent" : "workflow";
  });
  const [query, setQuery] = useState("");

  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode);
    localStorage.setItem("executions-sort-mode", mode);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return executions;
    return executions.filter((e) => {
      const name = e.workflowName?.toLowerCase() ?? "";
      return name.includes(q) || String(e.workflowId).includes(q);
    });
  }, [executions, query]);

  const groups = useMemo<ExecutionGroup[]>(() => {
    const grouped = new Map<number, ExecutionGroup>();

    for (const execution of filtered) {
      const existing = grouped.get(execution.workflowId);

      if (existing) {
        existing.executions.push(execution);
        continue;
      }

      grouped.set(execution.workflowId, {
        workflowId: execution.workflowId,
        workflowName: execution.workflowName,
        executions: [execution],
      });
    }

    return Array.from(grouped.values());
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No executions yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Run a workflow to see execution history here.
        </p>
        <Link href="/create" className="mt-4">
          <Button variant="outline" size="sm">
            Go to Workflows
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Search by workflow..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <SortToggle mode={sortMode} onChange={handleSortChange} />
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-border/60">
        <table className="w-full text-sm">
          <TableHead mode={sortMode} />

          {sortMode === "workflow" ? (
            <GroupedBody groups={groups} />
          ) : (
            <RecentBody executions={filtered} />
          )}
        </table>
      </div>
    </div>
  );
}

export default ExecutionsTable;
