import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Container } from "@/components/shared/Container";

const EXECUTIONS = [
  { id: 321, workflow: "Daily Report", run: 95, runtime: "3m 20s", status: "success" },
  { id: 320, workflow: "Data Sync", run: 121, runtime: "1m 2s", status: "success" },
  { id: 318, workflow: "Notification", run: 42, runtime: "8s", status: "failed" },
  { id: 318.1, workflow: "Data Sync", run: 120, runtime: "Pending", status: "pending" },
  { id: 317, workflow: "ETL Pipeline", run: 8, runtime: "52s", status: "success" },
];

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

export default function CreateExecutionsPage() {
  //  Dynamically calculated from the run column
  const totalRuns = EXECUTIONS.reduce((sum, e) => sum + e.run, 0);

  //  Success runs only
  const successfulRuns = EXECUTIONS.filter((e) => e.status === "success").reduce(
    (sum, e) => sum + e.run,
    0
  );

  // Success Rate in percentage
  const successRate =
    totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

  //Circle progress math
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (successRate / 100) * circumference;

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
              <table className="min-w-full divide-y divide-slate-800">
                <thead>
                  <tr className="text-slate-400 text-sm">
                    <th className="px-6 py-3 text-left">#</th>
                    <th className="px-6 py-3 text-left">Workflow</th>
                    <th className="px-6 py-3 text-left">Run #</th>
                    <th className="px-6 py-3 text-left">Runtime</th>
                    <th className="px-6 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {EXECUTIONS.map((e) => (
                    <tr
                      key={String(e.id)}
                      className="odd:bg-slate-900 even:bg-slate-900/70"
                    >
                      <td className="px-6 py-4 text-slate-100 font-medium">
                        {Math.floor(e.id)}
                      </td>
                      <td className="px-6 py-4 text-slate-100">{e.workflow}</td>
                      <td className="px-6 py-4 text-slate-200">{e.run}</td>
                      <td className="px-6 py-4 text-slate-300">{e.runtime}</td>
                      <td className="px-6 py-4">
                        <StatusPill status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Metrics Cards */}
        <div className="col-span-5 grid grid-cols-2 gap-4">
          {/*Total Runs */}
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
              1m 56s
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
                  points="0,8 6,4 12,6 18,3 24,5 30,4 36,6 40,5"
                />
              </svg>
            </div>
          </div>

          {/* Failures by Workflow */}
          <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-sm text-slate-300">Failures by Workflow</div>
            <div className="mt-3">
              <svg
                viewBox="0 0 100 36"
                className="w-full h-16 text-slate-500"
                aria-hidden
              >
                <path
                  d="M2 25 C18 18, 40 20, 58 14, 78 18, 98 12"
                  fill="none"
                  stroke="#93c5fd"
                  strokeWidth="1.8"
                />
              </svg>

              <div className="mt-3 flex items-end gap-3">
                <div className="w-6 h-3 bg-blue-700 rounded" />
                <div className="w-6 h-4 bg-blue-700 rounded" />
                <div className="w-6 h-5 bg-blue-700 rounded" />
                <div className="w-6 h-3 bg-blue-700 rounded" />
                <div className="w-6 h-6 bg-blue-700 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
