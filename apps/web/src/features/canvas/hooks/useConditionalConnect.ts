"use client";

import { useCallback } from "react";
import { addEdge, type Connection, type Edge } from "@xyflow/react";
import { createId } from "../utils/id";

const HANDLE_IDS = {
  TRUE: "true",
  FALSE: "false",
};

const EDGE_COLORS = {
  TRUE: "hsl(142 70% 45%)", // green
  FALSE: "hsl(0 70% 50%)", // red
};

/**
 * A custom onConnect handler that creates styled edges
 * based on the source handle ('true' or 'false').
 * TODO: This should also support switch/case nodes in the future.
 */
export function useConditionalConnect(
  setEdges: (updater: (edges: Edge[]) => Edge[] | Edge[]) => void,
) {
  return useCallback(
    (connection: Connection) => {
      const { sourceHandle } = connection;

      const isTrue = sourceHandle === HANDLE_IDS.TRUE;
      const isFalse = sourceHandle === HANDLE_IDS.FALSE;

      const label = isTrue || isFalse ? sourceHandle : undefined;
      const color = isTrue
        ? EDGE_COLORS.TRUE
        : isFalse
          ? EDGE_COLORS.FALSE
          : undefined;

      const newEdge: Edge = {
        ...connection,
        id: createId(),
        type: "default",
        animated: false,
        label,
        labelStyle: { fill: "white", fontWeight: 600 },
        labelShowBg: !!color,
        labelBgStyle: color ? { fill: color } : undefined,
        labelBgPadding: [2, 6],
        labelBgBorderRadius: 4,
      };

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges],
  );
}
