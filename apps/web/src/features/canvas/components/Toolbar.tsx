"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { Play, RotateCcw, Trash2, Save, Maximize } from "lucide-react";

type ToolbarProps = {
  onExecute: () => void;
  onUndo: () => void;
  onDelete: () => void;
  onSave: () => void;
  onFitView?: () => void;
};

export function Toolbar({ onExecute, onUndo, onDelete, onSave, onFitView }: ToolbarProps) {
  const Btn = ({
    onClick,
    title,
    children,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/40 px-2.5 text-xs hover:bg-muted/60"
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
      <Btn onClick={onSave} title="Save (⌘/Ctrl+S)">
        <Save className="h-4 w-4" /> Save
      </Btn>
      {onFitView && (
        <Btn onClick={onFitView} title="Fit View">
          <Maximize className="h-4 w-4" /> Fit
        </Btn>
      )}

      <span className="ml-2 text-xs text-muted-foreground">⌘/Ctrl+S saves</span>
    </div>
  );
}
