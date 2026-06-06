"use client";

import { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useDraggable } from "@neodrag/react";
import { cn } from "@/lib/cn";
import type { NodeKind } from "../types";
import { NODE_REGISTRY, resolveNodeColor } from "../lib/nodeRegistry";

export function NodeIcon({
  iconSrc,
  Icon,
  className,
  style,
}: {
  iconSrc?: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  className: string;
  style?: React.CSSProperties;
}) {
  return iconSrc ? (
    <Image src={iconSrc} alt="" width={14} height={14} className={className} aria-hidden />
  ) : (
    <Icon className={className} style={style} />
  );
}

type DraggableItemProps = {
  type: NodeKind;
  label: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
  shortcutKey?: string;
  onAssignShortcut?: (kind: NodeKind, key: string | null) => void;
  subtitle?: string;
};

export function DraggableItem({
  type,
  label,
  containerRef,
  onAdd,
  shortcutKey,
  onAssignShortcut,
  subtitle,
}: DraggableItemProps) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);

  const handleDrop = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      const flowEl = container?.querySelector<HTMLElement>(".react-flow");
      const rect = flowEl?.getBoundingClientRect() ?? container?.getBoundingClientRect();
      if (!rect) return;
      const inside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;
      if (inside) onAdd(type, clientX, clientY);
    },
    [containerRef, onAdd, type],
  );

  useDraggable(ref as unknown as React.RefObject<HTMLElement>, {
    position: pos,
    onDrag: ({ /* offsetX, offsetY, */ event }) => {
      setDragging(true);
      setPos({ x: 0, y: 0 });
      const e = event as MouseEvent | TouchEvent;
      let cx: number | undefined;
      let cy: number | undefined;
      if ("clientX" in e && "clientY" in e) {
        cx = e.clientX;
        cy = e.clientY;
      }
      if ((cx == null || cy == null) && "touches" in e && e.touches?.[0]) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      }
      if (typeof cx === "number" && typeof cy === "number") {
        setCursor({ x: cx, y: cy });
      }
    },
    onDragEnd: ({ event }) => {
      setDragging(false);
      setCursor(null);
      setPos({ x: 0, y: 0 });
      const e = event as MouseEvent | TouchEvent;
      let cx: number | undefined;
      let cy: number | undefined;
      if ("clientX" in e && "clientY" in e) {
        cx = e.clientX;
        cy = e.clientY;
      }
      if ((cx == null || cy == null) && "changedTouches" in e && e.changedTouches?.[0]) {
        cx = e.changedTouches[0].clientX;
        cy = e.changedTouches[0].clientY;
      }
      if (typeof cx === "number" && typeof cy === "number") {
        handleDrop(cx, cy);
      }
    },
  });

  const metadata = NODE_REGISTRY[type];
  const ItemIcon = metadata.icon;
  const tint = resolveNodeColor(metadata.colorTheme.base);
  const tintStyle: React.CSSProperties = {
    borderColor: `color-mix(in srgb, ${tint} 28%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${tint} 7%, transparent)`,
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!onAssignShortcut) return;
      e.preventDefault();
      setEditing(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onAssignShortcut],
  );

  const handleShortcutKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setEditing(false);
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        onAssignShortcut?.(type, null);
        setEditing(false);
        return;
      }

      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        onAssignShortcut?.(type, e.key);
        setEditing(false);
      }
    },
    [onAssignShortcut, type],
  );

  return (
    <>
      <button
        ref={ref}
        onClick={() => onAdd(type)}
        onContextMenu={handleContextMenu}
        className="flex cursor-grab items-center gap-2 rounded-[calc(var(--radius)-0.4rem)] border px-3 py-1.5 text-left text-xs backdrop-blur-sm transition-colors hover:bg-muted/30 active:cursor-grabbing"
        aria-label={`Add ${label}`}
        style={dragging ? { ...tintStyle, opacity: 0 } : tintStyle}
      >
        <NodeIcon
          iconSrc={metadata.iconSrc}
          Icon={ItemIcon}
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: tint }}
        />
        <span className="truncate">{label}</span>
        {subtitle && (
          <span className="ml-auto shrink-0 text-[0.65rem] text-muted-foreground/80">
            {subtitle}
          </span>
        )}
        {editing ? (
          <input
            ref={inputRef}
            className={cn(
              "w-6 rounded border border-primary/60 bg-muted/60 px-1 py-0.5 text-center text-[0.65rem] font-mono uppercase outline-none",
              !subtitle && "ml-auto",
            )}
            maxLength={1}
            onKeyDown={handleShortcutKeyDown}
            onBlur={() => setEditing(false)}
            readOnly
          />
        ) : shortcutKey ? (
          <kbd
            className={cn(
              "rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[0.65rem] font-mono text-muted-foreground uppercase",
              !subtitle && "ml-auto",
            )}
          >
            {shortcutKey}
          </kbd>
        ) : null}
      </button>
      {dragging &&
        cursor &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              transform: `translate(${cursor.x}px, ${cursor.y}px) translate(-50%, -50%) scale(1.6)`,
              pointerEvents: "none",
              zIndex: 9999,
            }}
          >
            <div
              className="flex items-center gap-2 rounded-[calc(var(--radius)-0.4rem)] border bg-card/80 px-3 py-1.5 text-left text-[0.8rem] shadow-md backdrop-blur-md"
              style={{ borderColor: `color-mix(in srgb, ${tint} 35%, transparent)` }}
            >
              <NodeIcon
                iconSrc={metadata.iconSrc}
                Icon={ItemIcon}
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: tint }}
              />
              <span>{label}</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
