"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NODE_REGISTRY } from "../../lib/nodeRegistry";
import {
  useVariableInput,
  parseVariableReferences,
  type Segment,
} from "../../hooks/useVariableInput";
import { useVariableTree } from "../../hooks/useVariableTree";
import { VariableAutocomplete } from "./VariableAutocomplete";
import { VariableTreeView } from "./VariableTreeView";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { VariableSource } from "../../lib/variableSchema";

type VariableInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  nodeId: string;
  multiline?: boolean;
};

function formatPillLabel(segment: Segment & { type: "variable" }): string {
  const parts: string[] = [segment.nodeName];
  if (segment.fieldPath) {
    parts.push(...segment.fieldPath.split("."));
  }
  return parts.join(" > ");
}

/**
 * Build a map from node label → CSS color variable using upstream sources.
 * This handles renamed nodes (e.g. "yt" instead of default "HTTP").
 */
function buildColorMap(sources: VariableSource[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const source of sources) {
    const meta = NODE_REGISTRY[source.nodeKind];
    if (meta) {
      map.set(source.nodeLabel, `var(${meta.colorTheme.base})`);
    }
  }
  return map;
}

/**
 * Build HTML string from segments for contentEditable rendering.
 * Text segments become plain text nodes; variable segments become styled pill spans
 * with data-value holding the raw $expression.
 */
function pillHtml(
  seg: Segment & { type: "variable" },
  colorMap: Map<string, string>,
  removeIndex: number,
): string {
  const color = colorMap.get(seg.nodeName);
  const label = formatPillLabel(seg);
  const borderStyle = color ? `border-color:${color};` : "";
  const bgStyle = color
    ? `background:color-mix(in srgb, ${color} 15%, transparent);`
    : "";
  const colorStyle = color ? `color:${color};` : "";
  return `<span contenteditable="false" data-value="${escapeAttr(seg.value)}" class="variable-pill" style="${borderStyle}${bgStyle}${colorStyle}">${escapeHtml(label)}<span class="variable-pill-remove" data-remove-index="${removeIndex}">\u00d7</span></span>\u200B`;
}

/**
 * Build HTML from segments, wrapping each line in a <div> to match the
 * browser's native contentEditable line structure. Without this, bare <br>
 * tags cause pills to jump to unexpected lines after the sync effect
 * rebuilds the DOM.
 */
function segmentsToHtml(
  segments: Segment[],
  colorMap: Map<string, string>,
  multiline: boolean,
): string {
  // First, build a flat list of inline HTML chunks, splitting text segments
  // on newlines so we know where line breaks are.
  const lines: string[][] = [[]];
  let variableIndex = 0;
  for (const seg of segments) {
    if (seg.type === "text") {
      const parts = seg.value.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) lines.push([]);
        if (parts[i]) lines[lines.length - 1].push(escapeHtml(parts[i]));
      }
    } else {
      lines[lines.length - 1].push(pillHtml(seg, colorMap, variableIndex));
      variableIndex += 1;
    }
  }

  if (lines.length === 1 && lines[0].length === 0) {
    return "";
  }

  if (!multiline && lines.length === 1) {
    return lines[0].join("");
  }

  // Multi-line: wrap each line in a <div> to match Chrome's native
  // contentEditable structure. Empty lines get a <br> placeholder.
  return lines
    .map((chunks) => {
      const content = chunks.join("");
      return `<div>${content || "<br>"}</div>`;
    })
    .join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function InlinePickerDropdown({
  sources,
  onSelect,
  onClose,
}: {
  sources: VariableSource[];
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [onClose]);

  const filteredSources = searchQuery
    ? sources
        .map((source) => {
          const lower = searchQuery.toLowerCase();
          if (source.nodeLabel.toLowerCase().includes(lower)) return source;
          const filtered = source.children.filter(
            (c) =>
              c.key.toLowerCase().includes(lower) ||
              c.path.toLowerCase().includes(lower),
          );
          if (filtered.length === 0) return null;
          return { ...source, children: filtered };
        })
        .filter((s): s is VariableSource => s !== null)
    : sources;

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border/60 bg-popover shadow-md animate-in fade-in-0 zoom-in-95"
    >
      <div className="border-b border-border/40 p-2">
        <div className="flex items-center gap-2 rounded-sm border border-input bg-muted/30 px-2 py-1">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="max-h-52 overflow-y-auto p-1.5">
        {sources.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No upstream variables available.
            <br />
            Connect nodes to see their outputs here.
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="py-3 text-center text-xs text-muted-foreground">
            No matching variables.
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSources.map((source) => {
              const meta = NODE_REGISTRY[source.nodeKind];
              const Icon = meta.icon;
              return (
                <SourceGroup
                  key={source.nodeId}
                  source={source}
                  icon={Icon}
                  colorVar={meta.colorTheme.base}
                  onSelect={(path) => {
                    onSelect(path);
                    onClose();
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SourceGroup({
  source,
  icon: Icon,
  colorVar,
  onSelect,
}: {
  source: VariableSource;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  colorVar: string;
  onSelect: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50">
        {isOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: `var(${colorVar})` }}
        />
        <span className="truncate">{source.nodeLabel}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/60">
          {source.children.length} fields
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-2 border-l border-border/40 pl-1">
          <VariableTreeView nodes={source.children} onSelect={onSelect} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function VariableInput({
  value,
  onChange,
  placeholder,
  className,
  nodeId,
  multiline = false,
}: VariableInputProps) {
  const sources = useVariableTree(nodeId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    showAutocomplete,
    autocompleteQuery,
    autocompleteLeft,
    segments,
    editableRef,
    isInternalChangeRef,
    handleInput,
    insertVariable,
    insertFromPicker,
    setShowAutocomplete,
  } = useVariableInput({ value, onChange });

  const variableRefs = useMemo(() => parseVariableReferences(value), [value]);

  // Build label -> color map from upstream sources (handles renamed nodes)
  const colorMap = buildColorMap(sources);

  // Sync segments -> contentEditable HTML only for external changes.
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const el = editableRef.current;
    if (!el) return;

    const newHtml = segmentsToHtml(segments, colorMap, multiline);
    const isFocused = document.activeElement === el;
    el.innerHTML = newHtml;
    if (isFocused) {
      // Place cursor at end after external update
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [segments, editableRef, colorMap, isInternalChangeRef, multiline]);

  const onInput = useCallback(() => {
    handleInput();
  }, [handleInput]);

  const handlePickerSelect = useCallback(
    (path: string) => {
      insertFromPicker(path);
      setPickerOpen(false);
    },
    [insertFromPicker],
  );

  const togglePicker = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPickerOpen((prev) => !prev);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const removeEl = target.closest(".variable-pill-remove") as HTMLElement | null;
      if (!removeEl) return;

      const indexRaw = removeEl.getAttribute("data-remove-index");
      if (!indexRaw) return;

      const removeIndex = Number.parseInt(indexRaw, 10);
      if (!Number.isFinite(removeIndex)) return;

      const ref = variableRefs[removeIndex];
      if (!ref) return;

      e.preventDefault();
      e.stopPropagation();

      const newValue = value.slice(0, ref.start) + value.slice(ref.end);
      onChange(newValue);

      editableRef.current?.focus();
    },
    [value, variableRefs, onChange, editableRef],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!multiline && e.key === "Enter") {
        e.preventDefault();
      }
    },
    [multiline],
  );

  const editableClasses = cn(
    "w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 pr-8 text-sm outline-none focus:ring-1 focus:ring-ring/40",
    "inline-variable-editable",
    multiline ? "min-h-[60px]" : "whitespace-nowrap overflow-x-auto",
    !value && "empty-placeholder",
  );

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <div
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          className={editableClasses}
          onInput={onInput}
          onClick={handleClick}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          data-placeholder={placeholder}
          role="textbox"
          aria-multiline={multiline}
        />

        {/* + button */}
        <button
          type="button"
          onClick={togglePicker}
          className={cn(
            "absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm transition-colors",
            multiline && "top-2.5 translate-y-0",
            pickerOpen
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground",
          )}
          title="Insert variable"
        >
          {pickerOpen ? (
            <X className="h-3 w-3" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Autocomplete dropdown (when typing $) */}
      {showAutocomplete && !pickerOpen && (
        <VariableAutocomplete
          sources={sources}
          query={autocompleteQuery}
          onSelect={insertVariable}
          onClose={() => setShowAutocomplete(false)}
          style={{ left: autocompleteLeft }}
        />
      )}

      {/* Full-width picker dropdown */}
      {pickerOpen && (
        <InlinePickerDropdown
          sources={sources}
          onSelect={handlePickerSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Inline styles for pills inside contentEditable */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
.inline-variable-editable .variable-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid;
  border-radius: 9999px;
  padding: 0px 4px 0px 8px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  vertical-align: baseline;
  user-select: all;
  cursor: default;
  margin: 0 2px;
  white-space: nowrap;
}
.inline-variable-editable .variable-pill-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  font-size: 12px;
  line-height: 1;
  opacity: 0.5;
  cursor: pointer;
  margin-left: 2px;
  transition: opacity 0.15s, background 0.15s;
}
.inline-variable-editable .variable-pill-remove:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 15%, transparent);
}
.inline-variable-editable.empty-placeholder:empty::before {
  content: attr(data-placeholder);
  color: hsl(var(--muted-foreground) / 0.6);
  pointer-events: none;
}
`,
        }}
      />
    </div>
  );
}
