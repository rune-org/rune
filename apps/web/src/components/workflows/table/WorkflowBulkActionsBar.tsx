import { Download, Play, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type WorkflowBulkActionsBarProps = {
  selectedCount: number;
  runnableCount: number;
  activatableCount: number;
  deactivatableCount: number;
  exportableCount: number;
  deletableCount: number;
  onRun: () => void | Promise<void>;
  onActivate: () => void | Promise<void>;
  onDeactivate: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onClear: () => void;
};

export function WorkflowBulkActionsBar({
  selectedCount,
  runnableCount,
  activatableCount,
  deactivatableCount,
  exportableCount,
  deletableCount,
  onRun,
  onActivate,
  onDeactivate,
  onExport,
  onDelete,
  onClear,
}: WorkflowBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="rounded-md border border-accent/35 bg-accent/10 p-3" aria-live="polite">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm font-medium text-foreground">
          {selectedCount} workflow{selectedCount > 1 ? "s" : ""} selected
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRun} disabled={runnableCount === 0}>
            <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Run ({runnableCount})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onActivate}
            disabled={activatableCount === 0}
          >
            Activate ({activatableCount})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDeactivate}
            disabled={deactivatableCount === 0}
          >
            Deactivate ({deactivatableCount})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={exportableCount === 0}
          >
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Export ({exportableCount})
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={deletableCount === 0}
          >
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Delete ({deletableCount})
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
