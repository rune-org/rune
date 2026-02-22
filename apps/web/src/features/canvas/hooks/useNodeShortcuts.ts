"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeKind } from "../types";
import { getDefaultShortcuts, isValidNodeKind } from "../lib/nodeRegistry";

const STORAGE_KEY = "rune-node-shortcuts";

function loadShortcuts(): Record<string, NodeKind> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        const result: Record<string, NodeKind> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (/^[a-z0-9]$/i.test(key) && isValidNodeKind(value)) {
            result[key.toLowerCase()] = value;
          }
        }
        return result;
      }
    }
  } catch {}
  return getDefaultShortcuts();
}

export function useNodeShortcuts() {
  const [shortcuts, setShortcuts] = useState<Record<string, NodeKind>>(loadShortcuts);

  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    } catch {
    }
  }, [shortcuts]);

  const shortcutsByKind = useMemo(() => {
    const map: Partial<Record<NodeKind, string>> = {};
    for (const [key, kind] of Object.entries(shortcuts)) {
      map[kind] = key;
    }
    return map;
  }, [shortcuts]);

  const assignShortcut = useCallback((kind: NodeKind, key: string | null) => {
    setShortcuts((prev) => {
      const next = { ...prev };

      for (const [k, v] of Object.entries(next)) {
        if (v === kind) delete next[k];
      }

      if (key) {
        const lowerKey = key.toLowerCase();
        // Remove duplicate: if this key was assigned to another kind, remove it (last-writer-wins)
        delete next[lowerKey];
        next[lowerKey] = kind;
      }

      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setShortcuts(getDefaultShortcuts());
  }, []);

  return {
    shortcuts,
    shortcutsRef,
    shortcutsByKind,
    assignShortcut,
    resetToDefaults,
  };
}
