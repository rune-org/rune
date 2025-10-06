"use client";

import { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@neodrag/react";
import { Bot, GitBranch, Globe, Mail, Play } from "lucide-react";
import type { NodeKind } from "../types";
import { iconFor } from "./NodeIcons";

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
      const e: any = event;
      let cx = e?.clientX as number | undefined;
      let cy = e?.clientY as number | undefined;
      if ((cx == null || cy == null) && e?.touches?.[0]) {
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
      const e: any = event;
      let cx = e?.clientX as number | undefined;
      let cy = e?.clientY as number | undefined;
      if ((cx == null || cy == null) && e?.changedTouches?.[0]) {
        cx = e.changedTouches[0].clientX;
        cy = e.changedTouches[0].clientY;
      }
      if (typeof cx === "number" && typeof cy === "number") {
        handleDrop(cx, cy);
      }
    },
  });

  const ItemIcon = iconFor(type);

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

export function LibraryGroups({ containerRef, onAdd }: LibraryProps) {
  const Group = ({
    title,
    icon: Icon,
    items,
  }: {
    title: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    items: { label: string; type: NodeKind }[];
  }) => (
    <details
      open
      className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
    >
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </summary>
      <div className="mt-2 grid gap-2">
        {items.map((i) => (
          <DraggableItem
            key={i.type}
            type={i.type}
            label={i.label}
            containerRef={containerRef}
            onAdd={onAdd}
          />
        ))}
      </div>
    </details>
  );

  return (
    <div className="flex flex-col gap-3">
      <Group
        title="Triggers"
        icon={Play}
        items={[{ label: "Manual Trigger", type: "trigger" }]}
      />
      <Group
        title="Core"
        icon={GitBranch}
        items={[{ label: "If", type: "if" }]}
      />
      <Group
        title="HTTP"
        icon={Globe}
        items={[{ label: "HTTP Request", type: "http" }]}
      />
      <Group
        title="Email"
        icon={Mail}
        items={[{ label: "SMTP Email", type: "smtp" }]}
      />
      <Group
        title="Agents"
        icon={Bot}
        items={[{ label: "Agent", type: "agent" }]}
      />
    </div>
  );
}
