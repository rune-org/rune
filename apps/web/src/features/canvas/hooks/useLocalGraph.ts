"use client";

import { useCallback, useEffect } from "react";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "../types";

type SavePayload = { nodes: CanvasNode[]; edges: Edge[] };

type Setter<T> = (updater: T[] | ((prev: T[]) => T[])) => void;

export function useLocalGraph(
  setNodes: Setter<CanvasNode>,
  setEdges: Setter<Edge>,
) {
  const save = useCallback(({ nodes, edges }: SavePayload) => {
    try {
      const payload = { nodes, edges, ts: Date.now() };
      localStorage.setItem("rune-canvas", JSON.stringify(payload));
    } catch {
      // ignore write errors
    }
  }, []);

  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem("rune-canvas");
      if (!raw) return;
      const { nodes, edges } = JSON.parse(raw ?? "{}");
      if (Array.isArray(nodes)) setNodes(nodes as CanvasNode[]);
      if (Array.isArray(edges)) setEdges(edges as Edge[]);
    } catch {
      // ignore parse errors
    }
  }, [setEdges, setNodes]);

  // one-time load on mount
  useEffect(() => {
    load();
  }, [load]);

  return { save, load } as const;
}
