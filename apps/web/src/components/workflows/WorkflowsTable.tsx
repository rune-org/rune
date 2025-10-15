"use client";

/**
 * This table reads workflows from the global AppState,
 * which is currently backed by ApiMock.getWorkflows() for demo purposes.
  
 * TODO: replace ApiMock + state wiring with real backend calls
 * (e.g., GET /workflows) and persist in a database. This component
 * is presentational and read-only until the backend is integrated.
 */

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppState } from "@/lib/state";
import type { WorkflowSummary } from "@/lib/api-mock";

// TODO: Actions that mutate workflows (create/save/delete/toggle) are intentionally
// unimplemented. These should be implemented via backend APIs and DB persistence.
// See comments in state.tsx and api-mock.ts.

function timeAgo(iso: string | null): string {
  if (!iso) return "N/A";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / (1000 * 60 * 60));
  if (h < 1) {
    const m = Math.max(1, Math.floor(diff / (1000 * 60)));
    return `${m}m ago`;
  }
  return `${h}hr. ago`;
}

function StatusBadge({ status }: { status: WorkflowSummary["status"] }) {
  if (status === "active")
    return (
      <Badge className="bg-emerald-900/40 text-emerald-200" variant="secondary">
        Active
      </Badge>
    );
  if (status === "disabled")
    return (
      <Badge className="bg-slate-800 text-slate-200" variant="secondary">
        Disabled
      </Badge>
    );
  return (
    <Badge className="bg-amber-900/40 text-amber-200" variant="secondary">
      Draft
    </Badge>
  );
}

type StatFilter = "all" | "active" | "runs" | "draft" | "failed";

export function WorkflowsTable() {
  const {
    state: { workflows, loading },
    actions,
  } = useAppState();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatFilter>("all");

  useEffect(() => {
    if (workflows.length === 0) void actions.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = workflows;
    switch (filter) {
      case "active":
        list = list.filter((w) => w.status === "active");
        break;
      case "draft":
        list = list.filter((w) => w.status === "draft");
        break;
      case "failed":
        list = list.filter((w) => w.lastRunStatus === "failed");
        break;
      case "runs":
        list = list.filter((w) => w.runs > 0);
        break;
      default:
        break;
    }
    if (!q) return list;
    return list.filter((w) => w.name.toLowerCase().includes(q));
  }, [workflows, query, filter]);

  const stats = useMemo(() => {
    const active = workflows.filter((w) => w.status === "active").length;
    const draft = workflows.filter((w) => w.status === "draft").length;
    const failed = workflows.filter((w) => w.lastRunStatus === "failed").length;
    const runs = workflows.reduce((sum, w) => sum + w.runs, 0);
    return { active, draft, failed, runs };
  }, [workflows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm">
          <button
            type="button"
            onClick={() =>
              setFilter((f) => (f === "active" ? "all" : "active"))
            }
            aria-pressed={filter === "active"}
            className={
              filter === "active"
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <span className="font-semibold">{stats.active}</span> Active
          </button>
          <button
            type="button"
            onClick={() => setFilter((f) => (f === "runs" ? "all" : "runs"))}
            aria-pressed={filter === "runs"}
            className={
              filter === "runs"
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <span className="font-semibold">{stats.runs}</span> Runs
          </button>
          <button
            type="button"
            onClick={() => setFilter((f) => (f === "draft" ? "all" : "draft"))}
            aria-pressed={filter === "draft"}
            className={
              filter === "draft"
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <span className="font-semibold">{stats.draft}</span> Draft
          </button>
          <button
            type="button"
            onClick={() =>
              setFilter((f) => (f === "failed" ? "all" : "failed"))
            }
            aria-pressed={filter === "failed"}
            className={
              filter === "failed"
                ? "text-accent"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <span className="font-semibold">{stats.failed}</span> Failed
          </button>
        </div>
      </div>

      <div className="relative">
        <Input
          placeholder="Search workflows..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Name</TableHead>
            <TableHead className="w-[20%]">Trigger Type</TableHead>
            <TableHead className="w-[20%]">Status</TableHead>
            <TableHead className="w-[15%]">Last Run</TableHead>
            <TableHead className="w-[10%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((w) => (
            <TableRow key={w.id} data-loading={loading ? "1" : undefined}>
              <TableCell className="font-medium text-foreground">
                {w.name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {w.triggerType}
              </TableCell>
              <TableCell>
                <StatusBadge status={w.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {timeAgo(w.lastRunAt)}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={`Actions for ${w.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <a href={`/create/app?workflow=${w.id}`}>
                        Open in Canvas
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableCaption>
          {filtered.length === 0
            ? loading
              ? "Loading workflows..."
              : "No workflows found."
            : `${filtered.length} workflow${filtered.length > 1 ? "s" : ""} total.`}
        </TableCaption>
      </Table>
    </div>
  );
}
