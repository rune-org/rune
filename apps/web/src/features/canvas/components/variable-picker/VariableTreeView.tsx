"use client";

import { memo, useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/toast";
import type { VariableTreeNode } from "../../lib/variableSchema";

type VariableTreeViewProps = {
  nodes: VariableTreeNode[];
  onSelect: (path: string) => void;
  depth?: number;
};

const TYPE_BADGE_STYLES: Record<VariableTreeNode["type"], string> = {
  string: "bg-green-500/15 text-green-600 dark:text-green-400",
  number: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  boolean: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  object: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  array: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  unknown: "bg-muted text-muted-foreground",
};

function TypeBadge({ type }: { type: VariableTreeNode["type"] }) {
  return (
    <span
      className={cn(
        "rounded px-1 py-0.5 text-[9px] font-medium uppercase leading-none",
        TYPE_BADGE_STYLES[type],
      )}
    >
      {type}
    </span>
  );
}

function formatSampleValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    return value.length > 30 ? `"${value.slice(0, 30)}..."` : `"${value}"`;
  }
  return String(value);
}

function TreeRow({
  node,
  onSelect,
  depth,
}: {
  node: VariableTreeNode;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isLeaf = !hasChildren;

  const handleClick = useCallback(() => {
    if (isLeaf) {
      onSelect(node.path);
    } else {
      setIsOpen((prev) => !prev);
    }
  }, [isLeaf, node.path, onSelect]);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void navigator.clipboard.writeText(node.path);
      toast.success("Path copied");
    },
    [node.path],
  );

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs transition-colors",
          isLeaf
            ? "cursor-pointer hover:bg-accent/50"
            : "cursor-pointer hover:bg-muted/50",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Expand chevron */}
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          {hasChildren ? (
            isOpen ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )
          ) : (
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          )}
        </span>

        {/* Field name */}
        <span className="shrink-0 font-medium text-foreground">{node.key}</span>

        {/* Type badge */}
        <TypeBadge type={node.type} />

        {/* Sample value preview */}
        {node.sampleValue !== undefined && (
          <span className="truncate text-[10px] text-muted-foreground/70">
            {formatSampleValue(node.sampleValue)}
          </span>
        )}

        {/* Copy path button (visible on hover) */}
        <button
          onClick={handleCopy}
          className="ml-auto hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground group-hover:block"
          title="Copy path"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>

      {/* Children */}
      {hasChildren && isOpen && (
        <VariableTreeView
          nodes={node.children!}
          onSelect={onSelect}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

const VariableTreeView = memo(function VariableTreeView({
  nodes,
  onSelect,
  depth = 0,
}: VariableTreeViewProps) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </div>
  );
});

export { VariableTreeView };
