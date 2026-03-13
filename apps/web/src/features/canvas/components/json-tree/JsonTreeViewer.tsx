"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { ChevronRight, ChevronDown, Copy, ClipboardCopy } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/toast";

type JsonTreeViewerProps = {
  data: unknown;
  rootPath?: string;
  onInsertPath?: (path: string) => void;
  defaultExpandDepth?: number;
  maxDepth?: number;
  className?: string;
};

const VALUE_STYLES = {
  string: "text-green-600 dark:text-green-400",
  number: "text-blue-600 dark:text-blue-400",
  boolean: "text-orange-600 dark:text-orange-400",
  null: "text-muted-foreground italic",
};

function formatValue(value: unknown): { text: string; style: string } {
  if (value === null) return { text: "null", style: VALUE_STYLES.null };
  if (value === undefined) return { text: "undefined", style: VALUE_STYLES.null };
  switch (typeof value) {
    case "string": {
      const truncated = value.length > 60 ? `${value.slice(0, 60)}...` : value;
      return { text: `"${truncated}"`, style: VALUE_STYLES.string };
    }
    case "number":
      return { text: String(value), style: VALUE_STYLES.number };
    case "boolean":
      return { text: String(value), style: VALUE_STYLES.boolean };
    default:
      return { text: String(value), style: VALUE_STYLES.null };
  }
}

function getCollapsedPreview(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    if (keys.length <= 3) return `{ ${keys.join(", ")} }`;
    return `{ ${keys.slice(0, 3).join(", ")}, ... }`;
  }
  return String(value);
}

function buildPath(parentPath: string, key: string | number): string {
  if (!parentPath) return String(key);
  if (typeof key === "number") return `${parentPath}[${key}]`;
  return `${parentPath}.${key}`;
}

function TreeNode({
  keyName,
  value,
  path,
  depth,
  defaultExpandDepth,
  maxDepth,
  onInsertPath,
  isLast,
}: {
  keyName: string | number | null;
  value: unknown;
  path: string;
  depth: number;
  defaultExpandDepth: number;
  maxDepth: number;
  onInsertPath?: (path: string) => void;
  isLast: boolean;
}) {
  const [isOpen, setIsOpen] = useState(depth < defaultExpandDepth);

  const isExpandable =
    value !== null &&
    typeof value === "object" &&
    depth < maxDepth;

  const entries = useMemo(() => {
    if (!isExpandable || !isOpen) return [];
    if (Array.isArray(value)) {
      return value.map((v, i) => ({ key: i, value: v }));
    }
    return Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => ({ key: k, value: v }),
    );
  }, [isExpandable, isOpen, value]);

  const handleCopyPath = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void navigator.clipboard.writeText(path);
      toast.success("Path copied");
    },
    [path],
  );

  const handleCopyValue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        void navigator.clipboard.writeText(JSON.stringify(value, null, 2));
        toast.success("Value copied");
      } catch {
        toast.error("Failed to copy");
      }
    },
    [value],
  );

  const handleInsert = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onInsertPath?.(path);
    },
    [onInsertPath, path],
  );

  const { text, style } = isExpandable
    ? { text: "", style: "" }
    : formatValue(value);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs font-mono transition-colors",
          isExpandable && "cursor-pointer hover:bg-muted/40",
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={isExpandable ? () => setIsOpen((p) => !p) : undefined}
      >
        {/* Expand chevron */}
        {isExpandable ? (
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            {isOpen ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Key name */}
        {keyName !== null && (
          <>
            <span className="shrink-0 text-purple-600 dark:text-purple-400">
              {typeof keyName === "number" ? keyName : `"${keyName}"`}
            </span>
            <span className="shrink-0 text-muted-foreground">:</span>
          </>
        )}

        {/* Value or collapsed preview */}
        {isExpandable ? (
          <span className="truncate text-muted-foreground/70">
            {isOpen
              ? Array.isArray(value)
                ? "["
                : "{"
              : getCollapsedPreview(value)}
          </span>
        ) : (
          <span className={cn("truncate", style)}>{text}</span>
        )}

        {/* Hover actions */}
        <div className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover:flex">
          {path && (
            <button
              onClick={handleCopyPath}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              title="Copy path"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={handleCopyValue}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            title="Copy value"
          >
            <ClipboardCopy className="h-3 w-3" />
          </button>
          {onInsertPath && path && (
            <button
              onClick={handleInsert}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              title="Insert path"
            >
              <span className="text-[9px] font-bold">+</span>
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpandable && isOpen && (
        <>
          {entries.map((entry, i) => (
            <TreeNode
              key={typeof entry.key === "number" ? entry.key : entry.key}
              keyName={entry.key}
              value={entry.value}
              path={buildPath(path, entry.key)}
              depth={depth + 1}
              defaultExpandDepth={defaultExpandDepth}
              maxDepth={maxDepth}
              onInsertPath={onInsertPath}
              isLast={i === entries.length - 1}
            />
          ))}
          <div
            className="text-xs font-mono text-muted-foreground/70"
            style={{ paddingLeft: `${depth * 14 + 4}px` }}
          >
            {Array.isArray(value) ? "]" : "}"}
          </div>
        </>
      )}
    </div>
  );
}

const JsonTreeViewer = memo(function JsonTreeViewer({
  data,
  rootPath = "",
  onInsertPath,
  defaultExpandDepth = 1,
  maxDepth = 8,
  className,
}: JsonTreeViewerProps) {
  if (data === undefined || data === null) {
    return (
      <div className={cn("text-xs text-muted-foreground italic", className)}>
        null
      </div>
    );
  }

  // If it's a primitive, render directly
  if (typeof data !== "object") {
    const { text, style } = formatValue(data);
    return (
      <div className={cn("text-xs font-mono", style, className)}>{text}</div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      <TreeNode
        keyName={null}
        value={data}
        path={rootPath}
        depth={0}
        defaultExpandDepth={defaultExpandDepth}
        maxDepth={maxDepth}
        onInsertPath={onInsertPath}
        isLast
      />
    </div>
  );
});

export { JsonTreeViewer };
export type { JsonTreeViewerProps };
