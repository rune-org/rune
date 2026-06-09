"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useExecution } from "@/features/canvas/context/ExecutionContext";

type EdgeSetter = (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void;
type SelectEdges = (node: Node, outgoing: Edge[]) => Edge[];

const STEP_MS = 650;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useMarketingSim(nodes: Node[], edges: Edge[], setEdges: EdgeSetter) {
  const { dispatch } = useExecution();
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const runGenerationRef = useRef(0);

  const graphRef = useRef({ nodes, edges });
  graphRef.current = { nodes, edges };

  const setEdgeState = useCallback(
    (id: string, state: "active" | "done") => {
      setEdges((es) =>
        es.map((e) =>
          e.id === id
            ? {
                ...e,
                animated: state === "active",
                style: { ...(e.style || {}), stroke: "var(--ring)" },
              }
            : e,
        ),
      );
    },
    [setEdges],
  );

  const clearStatuses = useCallback(() => {
    dispatch({ type: "RESET" });
    setEdges((es) =>
      es.map((e) => ({
        ...e,
        animated: false,
        style: { ...(e.style || {}), stroke: "var(--border)" },
      })),
    );
  }, [dispatch, setEdges]);

  const run = useCallback(
    async (selectEdges?: SelectEdges) => {
      if (runningRef.current) return;
      const runGeneration = ++runGenerationRef.current;
      const isCurrentRun = () => runningRef.current && runGeneration === runGenerationRef.current;

      runningRef.current = true;
      setRunning(true);
      clearStatuses();
      await delay(150);
      if (!isCurrentRun()) return;

      const { nodes, edges } = graphRef.current;

      const outgoing: Record<string, Edge[]> = {};
      edges.forEach((e) => {
        (outgoing[e.source] ||= []).push(e);
      });
      const nodeById: Record<string, Node> = {};
      nodes.forEach((n) => {
        nodeById[n.id] = n;
      });

      const start = nodes.find((n) => n.type === "trigger") ?? nodes[0];
      if (start) {
        const queue: string[] = [start.id];
        const visited = new Set<string>();

        while (queue.length) {
          if (!isCurrentRun()) return;
          const cur = queue.shift()!;
          if (visited.has(cur)) continue;
          visited.add(cur);

          dispatch({ type: "NODE_UPDATE", payload: { node_id: cur, status: "running" } });
          await delay(STEP_MS);
          if (!isCurrentRun()) return;
          dispatch({
            type: "NODE_UPDATE",
            payload: { node_id: cur, status: "success", output: { ok: true } },
          });

          const node = nodeById[cur];
          let next = outgoing[cur] ?? [];
          if (node && selectEdges) next = selectEdges(node, next);

          for (const edge of next) {
            if (!isCurrentRun()) return;
            setEdgeState(edge.id, "active");
            await delay(STEP_MS);
            if (!isCurrentRun()) return;
            setEdgeState(edge.id, "done");
            if (!visited.has(edge.target)) queue.push(edge.target);
          }
        }
      }

      if (runGeneration === runGenerationRef.current) {
        runningRef.current = false;
        setRunning(false);
      }
    },
    [clearStatuses, dispatch, setEdgeState],
  );

  const reset = useCallback(() => {
    runGenerationRef.current += 1;
    runningRef.current = false;
    setRunning(false);
    clearStatuses();
  }, [clearStatuses]);

  useEffect(() => {
    return () => {
      runGenerationRef.current += 1;
      runningRef.current = false;
    };
  }, []);

  return { running, run, reset } as const;
}
