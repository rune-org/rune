"use client";

import { LayoutGrid, Lock, LockOpen, GripVertical } from "lucide-react";
import { useRef, useState } from "react";
import { LibraryGroups } from "./LibraryGroups";
import type { NodeKind } from "../types";

export function Library({
  containerRef,
  onAdd,
}: {
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 16, y: 84 });
  const [open, setOpen] = useState(true);
  const [locked, setLocked] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if (locked || e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    dragRef.current = { dx: startX - pos.x, dy: startY - pos.y };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp, { once: true });
  };

  const onMouseMove = (e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const cont = containerRef.current?.getBoundingClientRect();
    const nx = e.clientX - d.dx;
    const ny = e.clientY - d.dy;
    if (!cont) {
      setPos({ x: nx, y: ny });
      return;
    }
    const clampedX = Math.max(8, Math.min(nx, cont.width - 260));
    const clampedY = Math.max(8, Math.min(ny, cont.height - 200));
    setPos({ x: clampedX, y: clampedY });
  };

  const onMouseUp = () => {
    dragRef.current = null;
    window.removeEventListener("mousemove", onMouseMove);
  };

  return (
    <div
      className="pointer-events-auto absolute z-[50]"
      style={{ left: pos.x, top: pos.y }}
    >
      {open && (
        <div className="w-[260px] rounded-[var(--radius)] border border-border/60 bg-card/90 shadow-xl">
          <div
            className="flex cursor-move items-center justify-between gap-2 border-b border-border/60 px-2 py-1.5"
            onMouseDown={onMouseDown}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GripVertical className="h-3.5 w-3.5" />
              Library
            </div>
            <div className="flex items-center gap-1">
              <button
                className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                Hide
              </button>
              <button
                className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setLocked((v) => !v)}
                aria-label={locked ? "Unlock" : "Lock"}
                title={locked ? "Unlock" : "Lock"}
              >
                {locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <LockOpen className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="p-2">
            <LibraryGroups onAdd={(type) => onAdd(type)} />
          </div>
        </div>
      )}
      {!open && (
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground hover:border-accent/60 hover:text-foreground"
          aria-label="Show library"
          onClick={() => setOpen(true)}
        >
          <LayoutGrid className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
