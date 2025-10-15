"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { Play, RotateCcw, Trash2, Save, Maximize, Copy } from "lucide-react";

type ToolbarProps = {
  onExecute: () => void;
  onUndo: () => void;
  onDelete: () => void;
  onSave: () => void;
  onExport: () => void;
  onFitView?: () => void;
  saveDisabled?: boolean; // Should be disabled globally when the workflows list page is ready.
};

export function Toolbar({
  onExecute,
  onUndo,
  onDelete,
  onSave,
  onExport,
  onFitView,
  saveDisabled = false,
}: ToolbarProps) {
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

      <Btn onClick={onExecute} title="Execute (simulate)">
        <Play className="h-4 w-4" /> Run
      </Btn>
      <Btn onClick={onUndo} title="Undo">
        <RotateCcw className="h-4 w-4" /> Undo
      </Btn>
      <Btn onClick={onDelete} title="Delete Selected">
        <Trash2 className="h-4 w-4" /> Delete
      </Btn>
      <Btn onClick={onSave} title="Save (disabled)" disabled={saveDisabled}>
        <Save className="h-4 w-4" /> Save
      </Btn>
      <Btn onClick={onExport} title="Export JSON to clipboard">
        <Copy className="h-4 w-4" /> Export
      </Btn>
      {onFitView && (
        <Btn onClick={onFitView} title="Fit View">
          <Maximize className="h-4 w-4" /> Fit
        </Btn>
      )}
    </div>
  );
}
