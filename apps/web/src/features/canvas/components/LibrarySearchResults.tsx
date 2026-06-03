"use client";

import { useMemo } from "react";
import { SearchX } from "lucide-react";
import type { NodeKind } from "../types";
import { searchLibrary } from "../lib/librarySearch";
import { DraggableItem } from "./DraggableItem";

type LibrarySearchResultsProps = {
  query: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
  shortcutsByKind?: Partial<Record<NodeKind, string>>;
  onAssignShortcut?: (kind: NodeKind, key: string | null) => void;
};

export function LibrarySearchResults({
  query,
  containerRef,
  onAdd,
  shortcutsByKind,
  onAssignShortcut,
}: LibrarySearchResultsProps) {
  const results = useMemo(() => searchLibrary(query), [query]);

  if (!results.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-xs text-muted-foreground">
        <SearchX className="h-5 w-5 text-muted-foreground/60" />
        <span>No nodes match &ldquo;{query.trim()}&rdquo;</span>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {results.map((item) => (
        <DraggableItem
          key={item.kind}
          type={item.kind}
          label={item.label}
          subtitle={item.serviceLabel ?? item.groupLabel}
          containerRef={containerRef}
          onAdd={onAdd}
          shortcutKey={shortcutsByKind?.[item.kind]}
          onAssignShortcut={onAssignShortcut}
        />
      ))}
    </div>
  );
}
