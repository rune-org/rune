import { Download, Play, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";

type WorkflowBulkActionsBarProps = {
  selectedCount: number;
  runnableCount: number;
  activatableCount: number;
  deactivatableCount: number;
  exportableCount: number;
  deletableCount: number;
  pending: boolean;
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
  pending,
  onRun,
  onActivate,
  onDeactivate,
  onExport,
  onDelete,
  onClear,
}: WorkflowBulkActionsBarProps) {
  return (
    <AnimatePresence initial={false}>
      {selectedCount > 0 ? (
        <motion.div
          key="workflow-bulk-actions"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="rounded-md border border-accent/35 bg-accent/10 p-3"
          aria-live="polite"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-sm font-medium text-foreground">
              {selectedCount} workflow{selectedCount > 1 ? "s" : ""} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRun}
                disabled={pending || runnableCount === 0}
              >
                <Play className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Run ({runnableCount})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onActivate}
                disabled={pending || activatableCount === 0}
              >
                Activate ({activatableCount})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDeactivate}
                disabled={pending || deactivatableCount === 0}
              >
                Deactivate ({deactivatableCount})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onExport}
                disabled={pending || exportableCount === 0}
              >
                <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Export ({exportableCount})
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={pending || deletableCount === 0}
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Delete ({deletableCount})
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={pending}>
                Clear
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
