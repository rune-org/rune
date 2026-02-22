"use client";

import { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@neodrag/react";
import type { NodeKind } from "../types";
import {
  getNodeIcon,
  getNodesByGroup,
  getAllGroups,
  getGroupLabel,
  getGroupIcon,
  getGroupColorClass,
  type NodeGroup,
} from "../lib/nodeRegistry";

type LibraryProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
  shortcutsByKind?: Partial<Record<NodeKind, string>>;
  onAssignShortcut?: (kind: NodeKind, key: string | null) => void;
};

type DraggableItemProps = {
  type: NodeKind;
  label: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
  shortcutKey?: string;
  onAssignShortcut?: (kind: NodeKind, key: string | null) => void;
};

function DraggableItem({
  type,
  label,
  containerRef,
  onAdd,
  shortcutKey,
  onAssignShortcut,
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
      const rect =
        flowEl?.getBoundingClientRect() ?? container?.getBoundingClientRect();
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
      if (
        (cx == null || cy == null) &&
        "changedTouches" in e &&
        e.changedTouches?.[0]
      ) {
        cx = e.changedTouches[0].clientX;
        cy = e.changedTouches[0].clientY;
      }
      if (typeof cx === "number" && typeof cy === "number") {
        handleDrop(cx, cy);
      }
    },
  });

  const ItemIcon = getNodeIcon(type);

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
        className="flex cursor-grab items-center gap-2 rounded-sm border border-border/60 bg-background/60 px-3 py-1 text-left text-xs active:cursor-grabbing hover:bg-muted/40"
        aria-label={`Add ${label}`}
        style={dragging ? { opacity: 0 } : undefined}
      >
        <ItemIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{label}</span>
        {editing ? (
          <input
            ref={inputRef}
            className="ml-auto w-6 rounded border border-primary/60 bg-muted/60 px-1 py-0.5 text-center text-[0.65rem] font-mono uppercase outline-none"
            maxLength={1}
            onKeyDown={handleShortcutKeyDown}
            onBlur={() => setEditing(false)}
            readOnly
          />
        ) : shortcutKey ? (
          <kbd className="ml-auto rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[0.65rem] font-mono text-muted-foreground uppercase">
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
            <div className="flex items-center gap-2 rounded-sm border border-border/60 bg-background/90 px-3 py-1.5 text-left text-[0.8rem] shadow-md">
              <ItemIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{label}</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

type GroupProps = {
  group: NodeGroup;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
  shortcutsByKind?: Partial<Record<NodeKind, string>>;
  onAssignShortcut?: (kind: NodeKind, key: string | null) => void;
};

function Group({ group, containerRef, onAdd, shortcutsByKind, onAssignShortcut }: GroupProps) {
  const Icon = getGroupIcon(group);
  const nodes = getNodesByGroup(group);
  const colorClass = getGroupColorClass(group);
  const title = getGroupLabel(group);

  // Alphabetical order
  const sortedNodes = [...nodes].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <details
      open
      className="rounded-sm border border-border/60 bg-muted/20 p-2"
    >
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
        <div className={`h-2 w-2 rounded-full ${colorClass}`} />
        <Icon className="h-3.5 w-3.5" />
        {title}
      </summary>
      <div className="mt-2 grid gap-2">
        {sortedNodes.map((node) => (
          <DraggableItem
            key={node.kind}
            type={node.kind}
            label={node.label}
            containerRef={containerRef}
            onAdd={onAdd}
            shortcutKey={shortcutsByKind?.[node.kind]}
            onAssignShortcut={onAssignShortcut}
          />
        ))}
      </div>
    </details>
  );
}

export function LibraryGroups({ containerRef, onAdd, shortcutsByKind, onAssignShortcut }: LibraryProps) {
  return (
    <div className="flex flex-col gap-3">
      {getAllGroups().map((group) => (
        <Group
          key={group}
          group={group}
          containerRef={containerRef}
          onAdd={onAdd}
          shortcutsByKind={shortcutsByKind}
          onAssignShortcut={onAssignShortcut}
        />
      ))}
    </div>
  );
}
