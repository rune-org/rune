"use client";

import { useCallback } from "react";
import { addEdge, type Connection, type Edge } from "@xyflow/react";
import { createId } from "../utils/id";
import {
  SWITCH_FALLBACK_HANDLE_ID,
  SWITCH_RULE_HANDLE_PREFIX,
  switchHandleLabelFromId,
} from "../utils/switchHandles";

const HANDLE_IDS = {
  TRUE: "true",
  FALSE: "false",
};

const EDGE_COLORS = { // Refers to colors of edge labels, not the actual edge colors
  TRUE: "hsl(142 70% 45%)", // green
  FALSE: "hsl(0 70% 50%)", // red
  SWITCH: "hsl(211 80% 55%)", // blue-ish
  FALLBACK: "hsl(220 9% 55%)", // muted gray
};

/**
 * A custom onConnect handler that creates styled edges
 * based on the source handle (if/switch nodes with labeled outputs).
 */
export function useConditionalConnect(
  setEdges: (updater: (edges: Edge[]) => Edge[] | Edge[]) => void,
) {
  return useCallback(
    (connection: Connection) => {
      const { sourceHandle } = connection;

      const isTrue = sourceHandle === HANDLE_IDS.TRUE;
      const isFalse = sourceHandle === HANDLE_IDS.FALSE;
      const isSwitchCase =
        typeof sourceHandle === "string" &&
        sourceHandle.startsWith(SWITCH_RULE_HANDLE_PREFIX);
      const isSwitchFallback = sourceHandle === SWITCH_FALLBACK_HANDLE_ID;

      const label =
        switchHandleLabelFromId(sourceHandle) ||
        (isTrue || isFalse ? sourceHandle : undefined);
      const color = isTrue
        ? EDGE_COLORS.TRUE
        : isFalse
          ? EDGE_COLORS.FALSE
          : isSwitchCase
            ? EDGE_COLORS.SWITCH
            : isSwitchFallback
              ? EDGE_COLORS.FALLBACK
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
