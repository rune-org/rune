"use client";

import { memo } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import {
  Play,
  RotateCcw,
  RotateCw,
  Save,
  Maximize,
  Upload,
  Download,
  LayoutDashboard,
  Clipboard,
  FileJson,
  FileBox,
  ChevronDown,
  Loader2,
  Square,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExecutionHistoryPanel } from "./ExecutionHistoryPanel";
import type { WorkflowExecutionStatus } from "../types/execution";
import { cn } from "@/lib/cn";

type ToolbarProps = {
  onExecute: () => void;
  onStop?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onExportToClipboard: () => void;
  onExportToFile: () => void;
  onExportToTemplate: () => void;
  onImportFromClipboard: () => void;
  onImportFromFile: () => void;
  onImportFromTemplate: () => void;
  onFitView?: () => void;
  onAutoLayout?: () => void;
  saveDisabled?: boolean;

  executionStatus?: WorkflowExecutionStatus;
  isStartingExecution?: boolean;
  workflowId?: number | null;
};

export const Toolbar = memo(function Toolbar({
  onExecute,
  onStop,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onExportToClipboard,
  onExportToFile,
  onExportToTemplate,
  onImportFromClipboard,
  onImportFromFile,
  onImportFromTemplate,
  onFitView,
  onAutoLayout,
  saveDisabled = false,
  executionStatus = "idle",
  isStartingExecution = false,
  workflowId,
}: ToolbarProps) {
  const isExecuting = executionStatus === "running" || isStartingExecution;
  const Btn = ({
    onClick,
    title,
    children,
    disabled,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      title={title}
      aria-label={title}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/40 px-2.5 text-xs hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );

  const btnClass =
    "inline-flex h-8 items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/40 px-2.5 text-xs hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border/60 bg-card/80 p-2 shadow-lg">
      <Link
        href="/create"
        className="mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 p-0 text-xs text-muted-foreground hover:border-accent/60 hover:bg-background/80 hover:text-foreground"
        title="Rune"
        aria-label="Rune"
      >
        <Logo href="" variant="glyph" className="h-5 w-5 translate-x-[1.5px]" />
      </Link>

      {isExecuting ? (
        <>
          <button
            title="Running..."
            disabled
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border px-2.5 text-xs",
              "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400"
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            {isStartingExecution ? "Starting..." : "Running..."}
          </button>
          {onStop && (
            <Btn onClick={onStop} title="Stop execution">
              <Square className="h-4 w-4" /> Stop
            </Btn>
          )}
        </>
      ) : (
        <Btn onClick={onExecute} title="Execute workflow">
          <Play className="h-4 w-4" /> Run
        </Btn>
      )}
      <ExecutionHistoryPanel workflowId={workflowId ?? null} />
      <Btn onClick={onUndo} title="Undo (Ctrl+Z)" disabled={!canUndo}>
        <RotateCcw className="h-4 w-4" /> Undo
      </Btn>
      <Btn onClick={onRedo} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo}>
        <RotateCw className="h-4 w-4" /> Redo
      </Btn>
      <Btn onClick={onSave} title="Save" disabled={saveDisabled}>
        <Save className="h-4 w-4" /> Save
      </Btn>

      <DropdownMenu>
        <DropdownMenuTrigger className={btnClass}>
          <Download className="h-4 w-4" /> Import{" "}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onImportFromClipboard} className="gap-2">
            <Clipboard className="h-4 w-4" /> From Clipboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImportFromFile} className="gap-2">
            <FileJson className="h-4 w-4" /> From File (JSON)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImportFromTemplate} className="gap-2">
            <FileBox className="h-4 w-4" /> From Templates
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={btnClass}>
          <Upload className="h-4 w-4" /> Export{" "}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onExportToClipboard} className="gap-2">
            <Clipboard className="h-4 w-4" /> To Clipboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportToFile} className="gap-2">
            <FileJson className="h-4 w-4" /> To File (JSON)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportToTemplate} className="gap-2">
            <FileBox className="h-4 w-4" /> Save as Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onFitView && (
        <Btn onClick={onFitView} title="Fit View">
          <Maximize className="h-4 w-4" /> Fit
        </Btn>
      )}
      {onAutoLayout && (
        <Btn onClick={onAutoLayout} title="Auto Layout">
          <LayoutDashboard className="h-4 w-4" /> Layout
        </Btn>
      )}
    </div>
  );
});
