"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import {
  Play,
  RotateCcw,
  Save,
  Maximize,
  Upload,
  Download,
  LayoutDashboard,
  Clipboard,
  FileJson,
  FileBox,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type OpenMenu = "import" | "export" | null;

type ToolbarProps = {
  onExecute: () => void;
  onUndo: () => void;
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
};

export function Toolbar({
  onExecute,
  onUndo,
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
}: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

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

      <Btn onClick={onExecute} title="Execute (simulate)">
        <Play className="h-4 w-4" /> Run
      </Btn>
      <Btn onClick={onUndo} title="Undo">
        <RotateCcw className="h-4 w-4" /> Undo
      </Btn>
      <Btn onClick={onSave} title="Save" disabled={saveDisabled}>
        <Save className="h-4 w-4" /> Save
      </Btn>

      <DropdownMenu
        open={openMenu === "import"}
        onOpenChange={(open) => setOpenMenu(open ? "import" : null)}
      >
        <DropdownMenuTrigger
          className={btnClass}
          onMouseEnter={() => setOpenMenu("import")}
        >
          <Download className="h-4 w-4" /> Import{" "}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onMouseLeave={() => setOpenMenu(null)}
        >
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

      <DropdownMenu
        open={openMenu === "export"}
        onOpenChange={(open) => setOpenMenu(open ? "export" : null)}
      >
        <DropdownMenuTrigger
          className={btnClass}
          onMouseEnter={() => setOpenMenu("export")}
        >
          <Upload className="h-4 w-4" /> Export{" "}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onMouseLeave={() => setOpenMenu(null)}
        >
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
}
