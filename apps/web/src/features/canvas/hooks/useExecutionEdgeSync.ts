"use client";

import { useEffect, useRef } from "react";
import type { Edge } from "@xyflow/react";
import type { ExecutionState } from "../types/execution";

type SetEdges = (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void;

export function useExecutionEdgeSync(
  executionState: ExecutionState,
  setEdges: SetEdges
) {
  // Track which nodes have been visited (have any execution data)
  const prevVisitedNodesRef = useRef<Set<string>>(new Set());
  const prevRunningNodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const { nodes: nodeMap, status: workflowStatus } = executionState;

    if (workflowStatus === "idle") {
      if (prevVisitedNodesRef.current.size > 0) {
        setEdges((edges) =>
          edges.map((e) => ({
            ...e,
            animated: false,
            style: { ...(e.style || {}), stroke: undefined },
          }))
        );
        prevVisitedNodesRef.current = new Set();
        prevRunningNodesRef.current = new Set();
      }
      return;
    }

    // Collect nodes that actually executed (have a meaningful status)
    // Only count nodes with status: running, success, failed, waiting
    const visitedNodes = new Set<string>();
    const runningNodes = new Set<string>();

    nodeMap.forEach((nodeData, nodeId) => {
      if (nodeData.status === "running" || nodeData.status === "success" || nodeData.status === "failed" || nodeData.status === "waiting") {
        visitedNodes.add(nodeId);
      }
      if (nodeData.status === "running") {
        runningNodes.add(nodeId);
      }
    });

    const newlyVisited = new Set<string>();
    visitedNodes.forEach((id) => {
      if (!prevVisitedNodesRef.current.has(id)) {
        newlyVisited.add(id);
      }
    });

    const nowRunning = new Set<string>();
    runningNodes.forEach((id) => {
      if (!prevRunningNodesRef.current.has(id)) {
        nowRunning.add(id);
      }
    });

    const stoppedRunning = new Set<string>();
    prevRunningNodesRef.current.forEach((id) => {
      if (!runningNodes.has(id)) {
        stoppedRunning.add(id);
      }
    });

    const hasChanges = newlyVisited.size > 0 || nowRunning.size > 0 || stoppedRunning.size > 0;

    if (hasChanges) {
      setEdges((edges) =>
        edges.map((edge) => {
          const targetVisited = visitedNodes.has(edge.target);
          const targetRunning = runningNodes.has(edge.target);
          const targetNewlyVisited = newlyVisited.has(edge.target);

          if (targetRunning) {
            return {
              ...edge,
              animated: true,
              style: {
                ...(edge.style || {}),
                stroke: "var(--ring)",
              },
            };
          }

          if (targetVisited && !targetRunning) {
            const currentStroke = (edge.style as Record<string, unknown> | undefined)?.stroke;
            if (targetNewlyVisited || stoppedRunning.has(edge.target) || !currentStroke) {
              return {
                ...edge,
                animated: false,
                style: {
                  ...(edge.style || {}),
                  stroke: "var(--ring)",
                },
              };
            }
          }

          return edge;
        })
      );
    }

    prevVisitedNodesRef.current = visitedNodes;
    prevRunningNodesRef.current = runningNodes;
  }, [executionState, setEdges]);

  useEffect(() => {
    if (
      executionState.status === "completed" ||
      executionState.status === "failed" ||
      executionState.status === "halted"
    ) {
      setEdges((edges) =>
        edges.map((e) => ({
          ...e,
          animated: false,
        }))
      );
    }
  }, [executionState.status, setEdges]);
}

export default useExecutionEdgeSync;
