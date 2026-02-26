"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import { NODE_REGISTRY } from "../../lib/nodeRegistry";
import type { VariableSource, VariableTreeNode } from "../../lib/variableSchema";

type FlatEntry = {
  path: string;
  label: string;
  type: VariableTreeNode["type"];
  nodeLabel: string;
  nodeKind: string;
};

type VariableAutocompleteProps = {
  sources: VariableSource[];
  query: string;
  onSelect: (path: string) => void;
  onClose: () => void;
  className?: string;
  style?: React.CSSProperties;
};

const TYPE_COLORS: Record<VariableTreeNode["type"], string> = {
  string: "text-green-600 dark:text-green-400",
  number: "text-blue-600 dark:text-blue-400",
  boolean: "text-orange-600 dark:text-orange-400",
  object: "text-purple-600 dark:text-purple-400",
  array: "text-yellow-600 dark:text-yellow-400",
  unknown: "text-muted-foreground",
};

const MAX_VISIBLE = 20;

function flattenSources(sources: VariableSource[]): FlatEntry[] {
  const entries: FlatEntry[] = [];

  function walk(nodes: VariableTreeNode[], source: VariableSource) {
    for (const node of nodes) {
      entries.push({
        path: node.path,
        label: node.key,
        type: node.type,
        nodeLabel: source.nodeLabel,
        nodeKind: source.nodeKind,
      });
      if (node.children) {
        walk(node.children, source);
      }
    }
  }

  for (const source of sources) {
    walk(source.children, source);
  }

  return entries;
}

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  return text.toLowerCase().includes(lower);
}

export function VariableAutocomplete({
  sources,
  query,
  onSelect,
  onClose,
  className,
  style,
}: VariableAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const flat = useMemo(() => flattenSources(sources), [sources]);

  const filtered = useMemo(() => {
    const matches = flat.filter(
      (entry) =>
        fuzzyMatch(query, entry.path) ||
        fuzzyMatch(query, entry.label) ||
        fuzzyMatch(query, entry.nodeLabel),
    );
    return matches.slice(0, MAX_VISIBLE);
  }, [flat, query]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            onSelect(filtered[selectedIndex].path);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) {
    return (
      <div
        className={cn(
          "absolute z-50 mt-1 w-64 rounded-md border border-border/60 bg-popover p-2 text-xs text-muted-foreground shadow-md",
          className,
        )}
        style={style}
      >
        No matching variables
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute z-50 mt-1 max-h-52 w-64 overflow-y-auto rounded-md border border-border/60 bg-popover py-1 shadow-md",
        className,
      )}
      style={style}
    >
      {filtered.map((entry, idx) => {
        const meta = NODE_REGISTRY[entry.nodeKind as keyof typeof NODE_REGISTRY];
        const Icon = meta?.icon;

        return (
          <button
            key={entry.path}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors",
              idx === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted/50",
            )}
            onClick={() => onSelect(entry.path)}
            onMouseEnter={() => setSelectedIndex(idx)}
          >
            {Icon && (
              <Icon
                className="h-3 w-3 shrink-0"
                style={meta ? { color: `var(${meta.colorTheme.base})` } : undefined}
              />
            )}
            <span className="truncate font-medium">{entry.path}</span>
            <span
              className={cn(
                "ml-auto shrink-0 text-[9px] uppercase",
                TYPE_COLORS[entry.type],
              )}
            >
              {entry.type}
            </span>
          </button>
        );
      })}
    </div>
  );
}
