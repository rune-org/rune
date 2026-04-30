"use client";

import { useEffect, useRef } from "react";
import type { CanvasNode, NodeKind } from "../types";

type CanvasShortcutsProps = {
  nodes: CanvasNode[];
  readOnly?: boolean;
  setNodes: (updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[]) => void;
  onSave: () => void;
  onSaveWithMessage?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy?: () => void;
  onSelectAll?: (firstId: string | null) => void;
  onDelete: () => void;
  shortcutsRef?: React.RefObject<Record<string, NodeKind>>;
  onNodeShortcut?: (kind: NodeKind) => void;
};

export function useCanvasShortcuts(opts: CanvasShortcutsProps) {
  // Ref stores the latest props, this allows the event listener
  // to access fresh data without needing to be re-attached on every render.
  const latestPropsRef = useRef(opts);
  useEffect(() => {
    latestPropsRef.current = opts;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { nodes, readOnly, setNodes, onSave, onUndo, onRedo, onCopy, onSelectAll, onDelete } =
        latestPropsRef.current;

      const target = e.target as Element | null;

      if (target?.closest('[role="dialog"], [data-inspector]')) return;

      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          (target as HTMLElement).isContentEditable);

      if (isEditable) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (readOnly) {
          e.preventDefault();
          return;
        }
        onDelete();
        return;
      }

      // select all
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
        onSelectAll?.(nodes[0]?.id ?? null);
        return;
      }

      // save with message (Shift+Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (readOnly) return;
        const { onSaveWithMessage } = latestPropsRef.current;
        if (onSaveWithMessage) onSaveWithMessage();
        return;
      }

      // save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (readOnly) return;
        onSave();
        return;
      }

      // redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (readOnly) return;
        onRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        if (readOnly) return;
        onRedo();
        return;
      }

      // undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (readOnly) return;
        onUndo();
        return;
      }

      // copy
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (onCopy) {
          e.preventDefault();
          onCopy();
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (e.repeat) return;
        const inCanvasContext = target === document.body || !!target?.closest(".react-flow");
        if (!inCanvasContext) return;

        const key = e.key.toLowerCase();
        const { shortcutsRef, onNodeShortcut } = latestPropsRef.current;
        const kind = shortcutsRef?.current?.[key];
        if (kind && onNodeShortcut) {
          e.preventDefault();
          if (readOnly) return;
          onNodeShortcut(kind);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
