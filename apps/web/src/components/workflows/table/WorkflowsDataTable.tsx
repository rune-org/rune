import type { CheckedState } from "@radix-ui/react-checkbox";

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
    <Table>
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
          <TableHead className="w-[7%]">ID</TableHead>
          <TableHead className="w-[27%]">Name</TableHead>
          <TableHead className="w-[17%]">Trigger Type</TableHead>
          <TableHead className="w-[17%]">Status</TableHead>
          <TableHead className="w-[15%]">Last Run</TableHead>
          <TableHead className="w-[13%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workflows.map((workflow) => (
          <TableRow
            key={workflow.id}
            data-state={selectedWorkflowIds.has(workflow.id) ? "selected" : undefined}
            data-loading={loading || isRowPending(workflow.id) ? "1" : undefined}
          >
            <TableCell>
              <Checkbox
                aria-label={`Select ${workflow.name}`}
                checked={selectedWorkflowIds.has(workflow.id)}
                onCheckedChange={(checked: CheckedState) => onToggleSelected(workflow.id, checked)}
              />
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{workflow.id}</TableCell>
            <TableCell className="font-medium text-foreground">
              <div className="flex items-center gap-2">
                <a
                  href={`/create/app?workflow=${workflow.id}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  {workflow.name}
                </a>

                {/* TODO: Show version badge & unpublished dot once WorkflowListItem exposes latest_version_number and has_unpublished_changes */}
                <Badge
                  variant={workflow.role === "owner" ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {workflow.role === "owner" ? "Owner" : "Shared"}
                </Badge>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{workflow.triggerType}</TableCell>
            <TableCell>
              <StatusBadge status={workflow.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              <LastRunCell lastRun={lastRunByWorkflow.get(workflow.id)} loaded={executionsLoaded} />
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
        ))}
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
