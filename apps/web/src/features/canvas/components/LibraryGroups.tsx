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
};

type DraggableItemProps = {
  type: NodeKind;
  label: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
};

function DraggableItem({
  type,
  label,
  containerRef,
  onAdd,
}: DraggableItemProps) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

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

  return (
    <>
      <button
        ref={ref}
        onClick={() => onAdd(type)}
        className="flex cursor-grab items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-background/60 px-3 py-1 text-left text-xs active:cursor-grabbing hover:bg-muted/40"
        aria-label={`Add ${label}`}
        style={dragging ? { opacity: 0 } : undefined}
      >
        <ItemIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{label}</span>
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
            <div className="flex items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-background/90 px-3 py-1.5 text-left text-[0.8rem] shadow-md">
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
};

function Group({ group, containerRef, onAdd }: GroupProps) {
  const Icon = getGroupIcon(group);
  const nodes = getNodesByGroup(group);
  const colorClass = getGroupColorClass(group);
  const title = getGroupLabel(group);

  // Alphabetical order
  const sortedNodes = [...nodes].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <details
      open
      className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
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
          />
        ))}
      </div>
    </details>
  );
}

export function LibraryGroups({ containerRef, onAdd }: LibraryProps) {
  return (
    <div className="flex flex-col gap-3">
      {getAllGroups().map((group) => (
        <Group
          key={group}
          group={group}
          containerRef={containerRef}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}
