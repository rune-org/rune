"use client";

import { ChevronLeft, ChevronsRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LibraryGroups } from "./LibraryGroups";
import type { NodeKind } from "../types";

export function Library({
  toolbarRef,
  onAdd,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Dynamically position the panel below the toolbar
  const [top, setTop] = useState(66); // Fallback
  useEffect(() => {
    const el = toolbarRef?.current;
    if (!el) return;
    const update = () => setTop(Math.round(el.getBoundingClientRect().height + 22));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [toolbarRef]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (closeBtnRef.current) {
      try { closeBtnRef.current.focus(); } catch {}
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "Tab" && panel) { // Trap focus to library panel
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

  const PANEL_WIDTH = 440;
  const GUTTER = 16; // Breathing room from left edge of screen

  return (
    <div className="pointer-events-none absolute inset-0 z-[40]">
      
      {/* Handle */}
      <button
        className="pointer-events-auto absolute left-1 top-1/2 z-[45] -translate-y-1/2 transform rounded-[calc(var(--radius)-0.2rem)] border border-border/60 bg-background/80 text-muted-foreground hover:border-accent/60 hover:text-foreground"
        style={{ width: 28, height: 96, opacity: open ? 0 : 1, transition: "opacity 150ms" }}
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
        className="pointer-events-auto absolute flex w-[440px] flex-col overflow-hidden rounded-[var(--radius)] border border-border/60 bg-card/90 shadow-xl"
        style={{
          top: top,
          height: `calc(100% - ${top}px - 12px)`,
          left: GUTTER,
          transform: open ? "translateX(0)" : `translateX(-${PANEL_WIDTH + GUTTER + 12}px)`,
          transition: "transform 180ms ease-out",
        }}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">Library</div>
          <button
            ref={closeBtnRef}
            className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close library"
            onClick={() => setOpen(false)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="h-full overflow-y-auto p-2">
          <LibraryGroups onAdd={(type) => onAdd(type)} />
        </div>
      </div>
    </div>
  );
}
