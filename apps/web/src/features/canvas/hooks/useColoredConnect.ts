"use client";

import { useCallback } from "react";
import { addEdge, type Connection, type Edge } from "@xyflow/react";
import { createId } from "../utils/id";

export function useColoredConnect(
  setEdges: (updater: (edges: Edge[]) => Edge[] | Edge[]) => void,
) {
  return useCallback(
    (c: Connection) => {
      const isTrue = c.sourceHandle === "true";
      const isFalse = c.sourceHandle === "false";
      const label = isTrue || isFalse ? c.sourceHandle : undefined;
      const color = isTrue
        ? "hsl(142 70% 45%)" // green
        : isFalse
          ? "hsl(0 70% 50%)" // red
          : undefined;

      setEdges((eds) =>
        addEdge(
          {
            ...c,
            id: createId(),
            type: "default",
            animated: false,
            label,
            style: color ? { stroke: color } : undefined,
            // white label text on a colored background
            labelStyle: { fill: "white", fontWeight: 600 },
            labelShowBg: !!color,
            labelBgStyle: color ? { fill: color } : undefined,
            labelBgPadding: [2, 6],
            labelBgBorderRadius: 4,
          },
          eds,
        ),
      );
    },
    [setEdges],
  );
}
