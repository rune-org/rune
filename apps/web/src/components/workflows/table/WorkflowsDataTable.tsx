import type { CheckedState } from "@radix-ui/react-checkbox";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/formatTime";
import type { WorkflowSummary } from "@/lib/workflows";
import type { ExecutionListItem as ApiExecutionListItem } from "@/client/types.gen";
import { WorkflowRowActions } from "@/components/workflows/table/WorkflowRowActions";

function StatusBadge({ status }: { status: WorkflowSummary["status"] }) {
  if (status === "active") {
    return (
      <Badge
        className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
        variant="secondary"
      >
        Active
      </Badge>
    );
  }

  return (
    <Badge
      className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
      variant="secondary"
    >
      Draft
    </Badge>
  );
}

function LastRunCell({ lastRun, loaded }: { lastRun?: ApiExecutionListItem; loaded: boolean }) {
  if (!loaded) return "\u2014";
  if (!lastRun) return "N/A";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{formatRelativeTime(lastRun.created_at)}</span>
      </TooltipTrigger>
      <TooltipContent>{formatAbsoluteTime(lastRun.created_at)}</TooltipContent>
    </Tooltip>
  );
}

type WorkflowsDataTableProps = {
  workflows: WorkflowSummary[];
  loading: boolean;
  selectedWorkflowIds: Set<string>;
  allFilteredSelected: boolean;
  someFilteredSelected: boolean;
  onSelectAllFiltered: (checked: CheckedState) => void;
  onToggleSelected: (workflowId: string, checked: CheckedState) => void;
  isRowPending: (id: string) => boolean;
  isRowExporting: (id: string) => boolean;
  isAdmin: boolean;
  lastRunByWorkflow: Map<string, ApiExecutionListItem>;
  executionsLoaded: boolean;
  onRun: (workflow: WorkflowSummary) => void;
  onExport: (workflow: WorkflowSummary) => void;
  onDelete: (workflow: WorkflowSummary) => void;
  onRename: (workflow: WorkflowSummary) => void;
  onToggleActive: (workflow: WorkflowSummary) => void;
  onShare: (workflow: WorkflowSummary) => void;
};

export function WorkflowsDataTable({
  workflows,
  loading,
  selectedWorkflowIds,
  allFilteredSelected,
  someFilteredSelected,
  onSelectAllFiltered,
  onToggleSelected,
  isRowPending,
  isRowExporting,
  isAdmin,
  lastRunByWorkflow,
  executionsLoaded,
  onRun,
  onExport,
  onDelete,
  onRename,
  onToggleActive,
  onShare,
}: WorkflowsDataTableProps) {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[4%] align-middle">
            <div className="flex items-center justify-center">
              <Checkbox
                aria-label="Select all visible workflows"
                className="mx-auto"
                checked={
                  allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false
                }
                onCheckedChange={onSelectAllFiltered}
              />
            </div>
          </TableHead>
          <TableHead className="w-[6%]">ID</TableHead>
          <TableHead className="w-[20%]">Name</TableHead>
          <TableHead className="w-[25%]">Description</TableHead>
          <TableHead className="w-[12%]">Trigger Type</TableHead>
          <TableHead className="w-[11%]">Status</TableHead>
          <TableHead className="w-[11%]">Last Run</TableHead>
          <TableHead className="w-[11%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workflows.map((workflow) => {
          const isSelected = selectedWorkflowIds.has(workflow.id);
          const description = workflow.description?.trim();

          return (
            <Fragment key={workflow.id}>
              <TableRow
                data-state={isSelected ? "selected" : undefined}
                data-loading={loading || isRowPending(workflow.id) ? "1" : undefined}
              >
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${workflow.name}`}
                    checked={isSelected}
                    onCheckedChange={(checked: CheckedState) =>
                      onToggleSelected(workflow.id, checked)
                    }
                  />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{workflow.id}</TableCell>
                <TableCell className="font-medium text-foreground">
                  <div className="flex min-w-0 items-center gap-2">
                    <a
                      href={`/create/app?workflow=${workflow.id}`}
                      className="min-w-0 flex-1 truncate text-foreground underline-offset-4 hover:underline"
                    >
                      {workflow.name}
                    </a>

                    <Badge
                      variant={workflow.role === "owner" ? "secondary" : "outline"}
                      className="shrink-0 text-xs"
                    >
                      {workflow.role === "owner" ? "Owner" : "Shared"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {description ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate">{description}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label={`Show full description for ${workflow.name}`}
                          >
                            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-lg whitespace-pre-wrap wrap-break-word text-left leading-relaxed">
                          {description}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <span className="italic text-muted-foreground/80">No description</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{workflow.triggerType}</TableCell>
                <TableCell>
                  <StatusBadge status={workflow.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <LastRunCell
                    lastRun={lastRunByWorkflow.get(workflow.id)}
                    loaded={executionsLoaded}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <WorkflowRowActions
                    workflow={workflow}
                    isAdmin={isAdmin}
                    isPending={isRowPending(workflow.id)}
                    isExporting={isRowExporting(workflow.id)}
                    onRun={onRun}
                    onExport={onExport}
                    onDelete={onDelete}
                    onRename={onRename}
                    onToggleActive={onToggleActive}
                    onShare={onShare}
                  />
                </TableCell>
              </TableRow>

              {isSelected ? (
                <TableRow className="bg-muted/20">
                  <TableCell />
                  <TableCell colSpan={7} className="py-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
                      Description
                    </p>
                    <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground">
                      {description || "No description provided."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
      <TableCaption>
        {workflows.length === 0
          ? loading
            ? "Loading workflows..."
            : "No workflows found."
          : `${workflows.length} workflow${workflows.length > 1 ? "s" : ""} total.`}
      </TableCaption>
    </Table>
  );
}
