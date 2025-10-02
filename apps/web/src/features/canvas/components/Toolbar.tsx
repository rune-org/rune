"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import type { NodeKind } from "../types";

export function Toolbar({ onAdd }: { onAdd: (type: NodeKind) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border/60 bg-card/80 p-2 shadow-lg">
      <Link
        href="/create"
        className="mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 hover:bg-background/80 p-0 text-xs text-muted-foreground hover:border-accent/60 hover:text-foreground"
      >
        <Logo href="" variant="glyph" className="h-5 w-5 translate-x-[1.5px]" />
      </Link>
      {(
        [
          ["trigger", "+ Trigger"],
          ["agent", "+ Agent"],
          ["if", "+ If"],
          ["http", "+ HTTP"],
          ["smtp", "+ SMTP"],
        ] as [NodeKind, string][]
      ).map(([kind, label]) => (
        <button
          key={kind}
          className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/40 px-3 py-1 text-xs hover:bg-muted/60"
          onClick={() => onAdd(kind)}
        >
          {label}
        </button>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">⌘/Ctrl+S saves</span>
    </div>
  );
}
