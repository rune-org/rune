import { Download, MoreHorizontal, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  canChangeWorkflowStatus,
  canDeleteWorkflow,
  canExecuteWorkflow,
  canRenameWorkflow,
  canShareWorkflow,
  canViewWorkflow,
} from "@/lib/permissions";
import type { WorkflowSummary } from "@/lib/workflows";

type WorkflowRowActionsProps = {
  workflow: WorkflowSummary;
  isAdmin: boolean;
  isPending: boolean;
  isExporting: boolean;
  onRun: (workflow: WorkflowSummary) => void;
  onExport: (workflow: WorkflowSummary) => void;
  onDelete: (workflow: WorkflowSummary) => void;
  onRename: (workflow: WorkflowSummary) => void;
  onToggleActive: (workflow: WorkflowSummary) => void;
  onShare: (workflow: WorkflowSummary) => void;
};

export function WorkflowRowActions({
  workflow,
  isAdmin,
  isPending,
  isExporting,
  onRun,
  onExport,
  onDelete,
  onRename,
  onToggleActive,
  onShare,
}: WorkflowRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {canExecuteWorkflow(workflow.role, isAdmin) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              disabled={isPending}
              onClick={() => onRun(workflow)}
              aria-label={`Run ${workflow.name}`}
            >
              <Play className="h-5 w-5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run workflow</TooltipContent>
        </Tooltip>
      )}
      {canViewWorkflow(workflow.role, isAdmin) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              disabled={isExporting}
              onClick={() => onExport(workflow)}
              aria-label={`Export ${workflow.name} to JSON`}
            >
              <Download className="h-5 w-5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export to JSON</TooltipContent>
        </Tooltip>
      )}
      {canDeleteWorkflow(workflow.role, isAdmin) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 hover:text-destructive"
              disabled={isPending}
              onClick={() => onDelete(workflow)}
              aria-label={`Delete ${workflow.name}`}
            >
              <Trash2 className="h-5 w-5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete workflow</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`More actions for ${workflow.name}`}
            disabled={isPending}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a href={`/create/app?workflow=${workflow.id}`}>Open in Canvas</a>
          </DropdownMenuItem>
          {canRenameWorkflow(workflow.role, isAdmin) && (
            <DropdownMenuItem onSelect={() => onRename(workflow)} disabled={isPending}>
              Rename
            </DropdownMenuItem>
          )}
          {canChangeWorkflowStatus(workflow.role, isAdmin) && (
            <DropdownMenuItem onSelect={() => onToggleActive(workflow)} disabled={isPending}>
              {workflow.status === "active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          )}
          {canExecuteWorkflow(workflow.role, isAdmin) && (
            <DropdownMenuItem onSelect={() => onRun(workflow)} disabled={isPending}>
              Run
            </DropdownMenuItem>
          )}
          {canViewWorkflow(workflow.role, isAdmin) && (
            <DropdownMenuItem onSelect={() => onExport(workflow)} disabled={isExporting}>
              Export to JSON
            </DropdownMenuItem>
          )}
          {canShareWorkflow(workflow.role, isAdmin) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onShare(workflow)} disabled={isPending}>
                Share
              </DropdownMenuItem>
            </>
          )}
          {/* TODO: Add "Publish Latest Version" once WorkflowListItem exposes has_unpublished_changes */}
          {canDeleteWorkflow(workflow.role, isAdmin) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => onDelete(workflow)}
                disabled={isPending}
                className="text-red-400 focus:text-red-300 data-highlighted:bg-red-500/10 data-highlighted:text-red-200"
              >
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
