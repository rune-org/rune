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
  onPushHistory: () => void;
}) {
  const {
    nodes,
    edges,
    selectedNodeId,
    setNodes,
    setEdges,
    onSave,
    onSelectAll,
    onPushHistory,
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

      // delete selected node(s)/edge(s)
      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
        const selectedEdgeIds = new Set(edges.filter((e) => (e as any).selected).map((e) => e.id as string));
        // fallback to single selectedNodeId if none flagged selected
        if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0 && selectedNodeId) selectedNodeIds.add(selectedNodeId);

        if (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) {
          onPushHistory();
          setNodes((ns) => ns.filter((n) => !selectedNodeIds.has(n.id)));
          setEdges((es) =>
            es.filter(
              (ed) =>
                !selectedEdgeIds.has(ed.id as string) &&
                !selectedNodeIds.has(ed.source as string) &&
                !selectedNodeIds.has(ed.target as string),
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
  }, [edges, nodes, onPushHistory, onSave, onSelectAll, selectedNodeId, setEdges, setNodes]);
}
