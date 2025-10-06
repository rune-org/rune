"use client";

import { useEffect, useRef } from "react";
import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

type CanvasShortcutsProps = {
  nodes: CanvasNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: (
    updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[],
  ) => void;
  setEdges: (updater: (edges: Edge[]) => Edge[] | Edge[]) => void;
  onSave: () => void;
  onSelectAll?: (firstId: string | null) => void;
  onPushHistory: () => void;
  onDelete: () => void;
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
      const {
        nodes,
        edges,
        selectedNodeId,
        setNodes,
        setEdges,
        onSave,
        onSelectAll,
        onPushHistory,
      } = latestPropsRef.current;

      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          (target as HTMLElement).isContentEditable);

      if (isEditable) return;

      // delete selected node(s)/edge(s)
      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedNodeIds = new Set(
          nodes.filter((n) => n.selected).map((n) => n.id),
        );
        const selectedEdgeIds = new Set(
          edges.filter((e) => e.selected).map((e) => e.id),
        );

        if (
          selectedNodeIds.size === 0 &&
          selectedEdgeIds.size === 0 &&
          selectedNodeId
        ) {
          selectedNodeIds.add(selectedNodeId);
        }

        if (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) {
          onPushHistory();
          setNodes((ns) => ns.filter((n) => !selectedNodeIds.has(n.id)));
          setEdges((es) =>
            es.filter(
              (ed) =>
                !selectedEdgeIds.has(ed.id) &&
                !selectedNodeIds.has(ed.source) &&
                !selectedNodeIds.has(ed.target),
            ),
          );
        }
        return;
      }

      // select all
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
        onSelectAll?.(nodes[0]?.id ?? null);
        return;
      }

      // save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
