"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Container } from "@/components/shared/Container";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const EXECUTIONS = [
  { id: 321, workflow: "Daily Report", run: 95, runtime: "3m 20s", status: "success" },
  { id: 320, workflow: "Data Sync", run: 121, runtime: "1m 2s", status: "success" },
  { id: 318, workflow: "Notification", run: 42, runtime: "8s", status: "failed" },
  { id: 318.1, workflow: "Data Sync", run: 120, runtime: "Pending", status: "pending" },
  { id: 317, workflow: "ETL Pipeline", run: 8, runtime: "52s", status: "success" },
];

/* ------------------------ Helpers ------------------------ */
function parseRuntime(runtime: string): number | null {
  if (runtime.toLowerCase() === "pending") return null;
  const match = runtime.match(/(?:(\d+)m)?\s*(\d+)s/);
  if (!match) return null;
  const minutes = match[1] ? parseInt(match[1]) : 0;
  const seconds = parseInt(match[2]);
  return minutes * 60 + seconds;
}

function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}

function StatusPill({ status }: { status: string }) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";
  if (status === "success")
    return (
      <span className={`${base} bg-green-900/60 text-green-300`}>Success</span>
    );
  if (status === "failed")
    return (
      <span className={`${base} bg-red-900/60 text-red-300`}>Failed</span>
    );
  return (
    <span className={`${base} bg-slate-800/60 text-slate-300`}>Pending</span>
  );
}

/* ------------------------ Page ------------------------ */
export default function CreateExecutionsPage() {
  /* === Metrics === */
  const totalRuns = EXECUTIONS.reduce((sum, e) => sum + e.run, 0);

  const successfulRuns = EXECUTIONS.filter((e) => e.status === "success").reduce(
    (sum, e) => sum + e.run,
    0
  );

  const successRate =
    totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (successRate / 100) * circumference;

  /* === Avg Runtime === */
  const runtimes = EXECUTIONS.map((e) => parseRuntime(e.runtime)).filter(
    Boolean
  ) as number[];
  const avgRuntime = runtimes.length
    ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length
    : 0;

  /* === Executions Over Time ===
     We'll generate a simple "trend" line based on runtime lengths:
     each runtime length (seconds) mapped to y-points scaled to 12px height
  */
  const runtimePoints = runtimes.map((r, i) => {
    const normalizedY = 12 - (r / Math.max(...runtimes)) * 8; // scale visually
    const normalizedX = (i / (runtimes.length - 1)) * 40;
    return `${normalizedX.toFixed(1)},${normalizedY.toFixed(1)}`;
  });
  const linePoints = runtimePoints.join(" ");

  /* === Failures by Workflow === */
  const failuresByWorkflow = EXECUTIONS.reduce<Record<string, number>>(
    (acc, e) => {
      if (e.status === "failed") {
        acc[e.workflow] = (acc[e.workflow] || 0) + 1;
      }
      return acc;
    },
    {}
  );

  const maxFailures = Math.max(...Object.values(failuresByWorkflow), 1);

  /* ------------------------ Render ------------------------ */
  return (
    <Container className="py-12" widthClassName="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <PageHeader
          title="Executions"
          description="Track workflow runs and inspect their outputs."
        />

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 border border-slate-700 bg-transparent text-slate-300 rounded-md px-3 py-2 text-sm">
            Filter by workflow
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              className="opacity-70"
              aria-hidden
            >
              <path d="M7 10l5 5 5-5z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="mt-8 grid grid-cols-12 gap-6">
        {/* Left: Executions Table */}
        <div className="col-span-7">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-100">Executions</h3>
            </div>

            <div className="border-t border-slate-800/60">
              <Table className="min-w-full">
                <TableHeader>
                  <tr className="text-slate-400 text-sm">
                    <TableHead className="px-6 py-3 text-left">#</TableHead>
                    <TableHead className="px-6 py-3 text-left">Workflow</TableHead>
                    <TableHead className="px-6 py-3 text-left">Run #</TableHead>
                    <TableHead className="px-6 py-3 text-left">Runtime</TableHead>
                    <TableHead className="px-6 py-3 text-left">Status</TableHead>
                  </tr>
                </TableHeader>

                <TableBody>
                  {EXECUTIONS.map((e) => (
                    <TableRow
                      key={String(e.id)}
                      className="odd:bg-slate-900 even:bg-slate-900/70"
                    >
                      <TableCell className="px-6 py-4 text-slate-100 font-medium">
                        {Math.floor(e.id)}
                      </TableCell>

                      <TableCell className="px-6 py-4 text-slate-100">
                        {e.workflow}
                      </TableCell>

                      <TableCell className="px-6 py-4 text-slate-200">
                        {e.run}
                      </TableCell>

                      <TableCell className="px-6 py-4 text-slate-300">
                        {e.runtime}
                      </TableCell>

                      <TableCell className="px-6 py-4">
                        <StatusPill status={e.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Right: Metrics Cards */}
        <div className="col-span-5 grid grid-cols-2 gap-4">
          {/* Total Runs */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm text-slate-300">Total Runs</div>
            <div className="mt-4 text-3xl font-semibold text-slate-100">
              {totalRuns}
            </div>
          </div>

          {/* Success Rate */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 flex flex-col items-center justify-center">
            <div className="text-sm text-slate-300">Success Rate</div>
            <div className="mt-3 flex items-center justify-center relative">
              <svg
                width="72"
                height="72"
                viewBox="0 0 36 36"
                className="rotate-[-90deg]"
              >
                <circle
                  cx="18"
                  cy="18"
                  r={radius}
                  stroke="#0f766e1a"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="18"
                  cy="18"
                  r={radius}
                  stroke="#10b981"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              </svg>
              <div className="absolute text-slate-100 text-lg font-semibold">
                {successRate}%
              </div>
            </div>
          </div>

          {/* Avg Runtime */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300">Avg. Runtime</div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                className="opacity-60"
                aria-hidden
              >
                <path
                  d="M12 2v20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="mt-4 text-2xl font-medium text-slate-100">
              {formatSeconds(Math.round(avgRuntime))}
            </div>
          </div>

          {/* Executions Over Time */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm text-slate-300">Executions Over Time</div>
            <div className="mt-3">
              <svg
                viewBox="0 0 40 12"
                className="w-full h-10 text-slate-500"
                aria-hidden
              >
                <polyline
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="1.6"
                  points={linePoints}
                />
              </svg>
            </div>
          </div>

          {/* Failures by Workflow */}
          <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm text-slate-300">Failures by Workflow</div>
            <div className="mt-3 flex items-end gap-3">
              {Object.entries(failuresByWorkflow).map(([workflow, count]) => (
                <div key={workflow} className="flex flex-col items-center">
                  <div
                    className="w-6 bg-blue-700 rounded"
                    style={{
                      height: `${(count / maxFailures) * 24 + 4}px`,
                    }}
                  />
                  <span className="text-xs text-slate-400 mt-1">
                    {workflow}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
