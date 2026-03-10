"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { ExecutionListItem, ExecutionListStatus } from "../types";
import { cn } from "@/lib/cn";
import Link from "next/link";

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
    running: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: "Running",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
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
        config.className
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ExecutionsTable({
  executions,
  isLoading,
}: ExecutionsTableProps) {
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
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 border-b border-border">
            <TableHead className="w-[140px]">Execution ID</TableHead>
            <TableHead className="w-[180px]">Workflow</TableHead>
            <TableHead className="w-[220px]">Status</TableHead>
            <TableHead className="w-[90px]">Duration</TableHead>
            <TableHead className="w-[120px]">Started</TableHead>
            <TableHead className="w-[120px]">Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.map((execution) => (
            <TableRow key={execution.executionId} className="transition-colors hover:bg-muted/30">
              <TableCell className="font-mono text-xs">
                {execution.executionId.slice(0, 8)}...
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {execution.workflowName || `Workflow #${execution.workflowId}`}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <StatusBadge status={execution.status} />
                  {execution.failureReason ? (
                    <p
                      className="max-w-[220px] truncate text-xs text-muted-foreground"
                      title={execution.failureReason}
                    >
                      {execution.failureReason}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="tabular-nums">
                {formatDuration(execution.durationMs)}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDate(execution.startedAt)}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {execution.completedAt ? formatDate(execution.completedAt) : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default ExecutionsTable;
