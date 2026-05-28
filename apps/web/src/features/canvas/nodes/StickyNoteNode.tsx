"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { NodeResizer, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { cn } from "@/lib/cn";
import {
  STICKY_NOTE_COLORS,
  STICKY_NOTE_FONT_SIZES,
  type StickyNoteColor,
  type StickyNoteData,
  type StickyNoteFontSize,
} from "../types";

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 180;
const MIN_WIDTH = 140;
const MIN_HEIGHT = 100;

const COLOR_PALETTE: Record<StickyNoteColor, { surface: string; swatch: string }> = {
  yellow: {
    surface: "bg-amber-100 border-amber-300/70 dark:bg-amber-200/15 dark:border-amber-300/25",
    swatch: "bg-amber-300",
  },
  green: {
    surface: "bg-green-100 border-green-300/70 dark:bg-green-200/15 dark:border-green-300/25",
    swatch: "bg-green-300",
  },
  blue: {
    surface: "bg-sky-100 border-sky-300/70 dark:bg-sky-200/15 dark:border-sky-300/25",
    swatch: "bg-sky-300",
  },
  pink: {
    surface: "bg-pink-100 border-pink-300/70 dark:bg-pink-200/15 dark:border-pink-300/25",
    swatch: "bg-pink-300",
  },
  purple: {
    surface: "bg-violet-100 border-violet-300/70 dark:bg-violet-200/15 dark:border-violet-300/25",
    swatch: "bg-violet-300",
  },
  gray: {
    surface: "bg-zinc-100 border-zinc-300/70 dark:bg-zinc-200/10 dark:border-zinc-300/20",
    swatch: "bg-zinc-300",
  },
};

const FONT_SCALE: Record<StickyNoteFontSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

const NOTE_MD_OVERRIDES = cn(
  "[&_h1]:mt-0 [&_h1]:mb-1 [&_h1]:text-base",
  "[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:border-0 [&_h2]:pb-0 [&_h2]:text-sm",
  "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm",
  "[&_p]:my-1 [&_p]:leading-snug",
  "[&_ul]:my-1 [&_ol]:my-1 [&_li]:mt-0",
  "[&_blockquote]:my-1 [&_pre]:my-1 [&_hr]:my-2",
);

export const StickyNoteNode = memo(function StickyNoteNode({
  id,
  data,
  selected,
}: NodeProps<Node<StickyNoteData>>) {
  const { updateNodeData } = useReactFlow();

  const color: StickyNoteColor = data.color ?? "yellow";
  const fontSize: StickyNoteFontSize = data.fontSize ?? "md";
  const width = data.width ?? DEFAULT_WIDTH;
  const height = data.height ?? DEFAULT_HEIGHT;
  const content = data.content ?? "";

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [isEditing]);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraft(content);
      setIsEditing(true);
    },
    [content],
  );

  const commit = useCallback(() => {
    setIsEditing(false);
    if (draft !== content) updateNodeData(id, { content: draft });
  }, [draft, content, id, updateNodeData]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        onResize={(_, params) => updateNodeData(id, { width: params.width, height: params.height })}
        lineClassName="border-2 border-foreground/15"
        handleStyle={{
          width: 16,
          height: 16,
          border: "none",
          borderRadius: 9999,
          background:
            "radial-gradient(circle, var(--foreground) 0 3.5px, transparent 4px), radial-gradient(circle, var(--background) 0 5.5px, transparent 6px)",
        }}
      />

      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-md border shadow-md",
          COLOR_PALETTE[color].surface,
          selected && "ring-1 ring-foreground/30",
        )}
        style={{ width, height }}
        onDoubleClick={startEditing}
      >
        {selected && !isEditing && (
          <div className="nodrag flex shrink-0 items-center gap-1.5 border-b border-foreground/10 px-2 py-1">
            {STICKY_NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Color ${c}`}
                onClick={() => updateNodeData(id, { color: c })}
                className={cn(
                  "aspect-square h-3.5 w-3.5 min-w-0 rounded-full border border-black/10 transition-transform hover:scale-110",
                  COLOR_PALETTE[c].swatch,
                  color === c && "ring-2 ring-foreground/40 ring-offset-1",
                )}
              />
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {STICKY_NOTE_FONT_SIZES.map((fs) => (
                <button
                  key={fs}
                  type="button"
                  title={`Font size ${fs}`}
                  aria-label={`Font size ${fs}`}
                  onClick={() => updateNodeData(id, { fontSize: fs })}
                  className={cn(
                    "shrink-0 rounded px-1 text-[10px] font-semibold uppercase leading-4 transition-colors",
                    fontSize === fs
                      ? "bg-foreground/15 text-foreground"
                      : "text-foreground/50 hover:text-foreground",
                  )}
                >
                  {fs}
                </button>
              ))}
            </div>
          </div>
        )}

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                commit();
              }
            }}
            placeholder="Write markdown…"
            className={cn(
              "nodrag nowheel flex-1 resize-none bg-transparent p-2 text-foreground outline-none placeholder:text-foreground/40",
              FONT_SCALE[fontSize],
            )}
          />
        ) : (
          <div
            className={cn(
              "nowheel flex-1 overflow-auto p-2 text-foreground/90",
              FONT_SCALE[fontSize],
            )}
          >
            {content.trim() ? (
              <MarkdownRenderer
                content={content}
                className={cn("text-foreground/90", NOTE_MD_OVERRIDES)}
              />
            ) : (
              <span className="text-foreground/40">Double-click to edit…</span>
            )}
          </div>
        )}

        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-4 w-4"
          style={{
            background:
              "linear-gradient(135deg, transparent 50%, color-mix(in srgb, var(--foreground) 22%, transparent) 50%)",
            borderTopLeftRadius: "5px",
          }}
        />
      </div>
    </>
  );
});
