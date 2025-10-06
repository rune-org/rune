"use client";

import { useCallback, useRef, useState } from "react";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "../types";

type Setter<T> = (updater: T[] | ((prev: T[]) => T[])) => void;

export function useExecutionSim(
  nodes: CanvasNode[],
  edges: Edge[],
  setNodes: Setter<CanvasNode>,
  setEdges: Setter<Edge>,
) {
  const [running, setRunning] = useState(false);
  const stopRef = useRef<{ stopped: boolean } | null>(null);

  const reset = useCallback(() => {
    setEdges((es) =>
      es.map((e) => ({ ...e, animated: false, style: { ...(e.style || {}) } })),
    );
  }, [setEdges]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    stopRef.current = { stopped: false };

    // adjacency list by source id
    const out: Record<string, Edge[]> = {};
    const inDeg: Record<string, number> = {};
    edges.forEach((e) => {
      if (!out[e.source]) out[e.source] = [];
      out[e.source].push(e);
      inDeg[e.target] = (inDeg[e.target] || 0) + 1;
      if (!(e.source in inDeg)) inDeg[e.source] = inDeg[e.source] || 0;
    });

    let startNodes: CanvasNode[] = nodes.filter(
      (n): n is CanvasNode => n.type === "trigger",
    );
    if (startNodes.length === 0) {
      startNodes = nodes.filter((n) => (inDeg[n.id] || 0) === 0);
    }
    if (startNodes.length === 0 && nodes.length)
      startNodes = [nodes[0] as CanvasNode];

    const visited = new Set<string>();
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // highlight helper
    const activateEdge = (id: string, on: boolean) => {
      setEdges((es) =>
        es.map((e) =>
          e.id === id
            ? {
                ...e,
                animated: on,
                style: {
                  ...(e.style || {}),
                  stroke: on ? "var(--ring)" : undefined,
                },
              }
            : e,
        ),
      );
    };

    for (const start of startNodes) {
      const q: string[] = [start.id];
      while (q.length) {
        if (stopRef.current?.stopped) break;
        const cur = q.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);

        const nextEs = out[cur] || [];
        for (const e of nextEs) {
          activateEdge(e.id, true);
          await delay(500);
          activateEdge(e.id, false);
          if (!visited.has(e.target)) q.push(e.target);
        }
      }
    }

    setRunning(false);
  }, [edges, nodes, setEdges, running]);

  const stop = useCallback(() => {
    if (stopRef.current) stopRef.current.stopped = true;
    setRunning(false);
    reset();
  }, [reset]);

  return { running, run, stop, reset } as const;
}
