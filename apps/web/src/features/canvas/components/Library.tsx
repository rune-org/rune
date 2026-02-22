"use client";

import { ChevronLeft, ChevronsRight, GripHorizontal, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LibraryGroups } from "./LibraryGroups";
import type { NodeKind } from "../types";

export function Library({
  containerRef,
  toolbarRef,
  onAdd,
  shortcutsByKind,
  onAssignShortcut,
  onResetShortcuts,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
  shortcutsByKind?: Partial<Record<NodeKind, string>>;
  onAssignShortcut?: (kind: NodeKind, key: string | null) => void;
  onResetShortcuts?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(300);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const handleBtnRef = useRef<HTMLButtonElement | null>(null);

  // Dynamically position the panel below the toolbar
  const [top, setTop] = useState(66); // Fallback
  useEffect(() => {
    const el = toolbarRef?.current;
    if (!el) return;
    const update = () =>
      setTop(Math.round(el.getBoundingClientRect().height + 22));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [toolbarRef]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (closeBtnRef.current) {
      try {
        closeBtnRef.current.focus();
      } catch {}
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "Tab" && panel) {
        // Trap focus to library panel
        const focusables = panel.querySelectorAll<HTMLElement>(
          'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsidePanel = panelRef.current?.contains(target);
      const isInsideHandle = handleBtnRef.current?.contains(target);

      if (!isInsidePanel && !isInsideHandle) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [open]);

  const GUTTER = 16; // Breathing room from left edge of screen
  // Drag to resize
  const resizerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const resizer = resizerRef.current;
    if (!resizer) return;

    let startX = 0;
    let startWidth = panelWidth;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, startWidth + e.clientX - startX);
      setPanelWidth(newWidth);
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    const onMouseDown = (e: MouseEvent) => {
      startX = e.clientX;
      startWidth = panelWidth;
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    };

    resizer.addEventListener("mousedown", onMouseDown);
    return () => resizer.removeEventListener("mousedown", onMouseDown);
  }, [panelWidth]);
 

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {/* Handle */}
      <button
        ref={handleBtnRef}
        className="pointer-events-auto absolute left-1 top-1/2 z-45 -translate-y-1/2 transform rounded-[calc(var(--radius)-0.2rem)] border border-border/60 bg-background/80 text-muted-foreground hover:border-accent/60 hover:text-foreground"
        style={{
          width: 28,
          height: 96,
          opacity: open ? 0 : 1,
          transition: "opacity 150ms",
        }}
        aria-label="Open library"
        onClick={() => setOpen(true)}
      >
        <div className="flex h-full items-center justify-center">
          <ChevronsRight className="h-5 w-5" />
        </div>
      </button>

      {/* Sliding library panel */}
      <div
        ref={panelRef}
        className="pointer-events-auto absolute flex flex-col overflow-visible rounded-(--radius) border border-border/60 bg-card/90 shadow-xl"
        style={{
          top: top,
          height: `calc(100% - ${top}px - 12px)`,
          left: GUTTER,
          width: panelWidth,
          transform: open ? "translateX(0)" : `translateX(-${panelWidth + GUTTER + 12}px)`,
          transition: "transform 180ms ease-out",
        }}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              Library
            </div>
            {onResetShortcuts && (
              <button
                className="inline-flex items-center gap-1 rounded-sm p-0.5 text-muted-foreground/40 transition-colors hover:bg-muted/40 hover:text-muted-foreground"
                onClick={onResetShortcuts}
                title="Reset keyboard shortcuts to defaults"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            ref={closeBtnRef}
            className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close library"
            onClick={() => setOpen(false)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto p-2">
          <LibraryGroups
            containerRef={containerRef}
            onAdd={onAdd}
            shortcutsByKind={shortcutsByKind}
            onAssignShortcut={onAssignShortcut}
          />
        </div>

        {/* Resizer handle */}
        <div
          ref={resizerRef}
          className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
        >
          <GripHorizontal className="h-full w-full text-border/50" />
        </div>
      </div>
    </div>
  );
}
