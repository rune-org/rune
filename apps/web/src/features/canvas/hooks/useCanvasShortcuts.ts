"use client";

import { useEffect } from "react";
import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

export function useCanvasShortcuts(opts: {
  nodes: CanvasNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: (
    updater: (nodes: CanvasNode[]) => CanvasNode[] | CanvasNode[],
  ) => void;
  setEdges: (updater: (edges: Edge[]) => Edge[] | Edge[]) => void;
  onSave: () => void;
  onSelectAll?: (firstId: string | null) => void;
}) {
  const {
    nodes,
    edges,
    selectedNodeId,
    setNodes,
    setEdges,
    onSave,
    onSelectAll,
  } = opts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          (target as HTMLElement).isContentEditable ||
          !!target.closest('[contenteditable="true"]'));

      if (isEditable) return;

      // delete selected node (and its incident edges)
      if (e.key === "Delete" || e.key === "Backspace") {
        setNodes((ns) => ns.filter((n) => n.id !== selectedNodeId));
        setEdges((es) =>
          es.filter(
            (ed) =>
              ed.source !== selectedNodeId && ed.target !== selectedNodeId,
          ),
        );
        return;
      }

      // select all nodes
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
  }, [edges, nodes, onSave, onSelectAll, selectedNodeId, setEdges, setNodes]);
}
