"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "../types";

export type HistoryEntry = { nodes: CanvasNode[]; edges: Edge[] };

type HistoryState = {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
};

const MAX_HISTORY_SIZE = 50;

export type UseCanvasHistoryOptions = {
  maxSize?: number;
};

export type UseCanvasHistoryReturn = {
  /** Push current state to history. */
  pushHistory: () => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
};

export function useCanvasHistory(
  nodes: CanvasNode[],
  edges: Edge[],
  options: UseCanvasHistoryOptions = {}
): UseCanvasHistoryReturn {
  const { maxSize = MAX_HISTORY_SIZE } = options;

  const historyRef = useRef<HistoryState>({ undoStack: [], redoStack: [] });
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncState = useCallback(() => {
    const { undoStack, redoStack } = historyRef.current;
    setCanUndo(undoStack.length > 0);
    setCanRedo(redoStack.length > 0);
  }, []);

  const pushHistory = useCallback(() => {
    const { undoStack } = historyRef.current;

    undoStack.push(
      structuredClone({
        nodes: nodesRef.current,
        edges: edgesRef.current,
      })
    );

    while (undoStack.length > maxSize) {
      undoStack.shift();
    }

    // Clear redo stack when new action is taken
    historyRef.current = {
      undoStack,
      redoStack: [],
    };

    syncState();
  }, [maxSize, syncState]);

  const undo = useCallback((): HistoryEntry | null => {
    const { undoStack, redoStack } = historyRef.current;

    if (undoStack.length === 0) {
      return null;
    }

    // Save current state to redo stack
    redoStack.push(
      structuredClone({
        nodes: nodesRef.current,
        edges: edgesRef.current,
      })
    );

    while (redoStack.length > maxSize) {
      redoStack.shift();
    }

    // Pop from undo stack
    const stateToRestore = undoStack.pop()!;

    historyRef.current = { undoStack, redoStack };
    syncState();

    return stateToRestore;
  }, [maxSize, syncState]);

  const redo = useCallback((): HistoryEntry | null => {
    const { undoStack, redoStack } = historyRef.current;

    if (redoStack.length === 0) {
      return null;
    }

    // Save current state to undo stack
    undoStack.push(
      structuredClone({
        nodes: nodesRef.current,
        edges: edgesRef.current,
      })
    );

    while (undoStack.length > maxSize) {
      undoStack.shift();
    }

    // Pop from redo stack
    const stateToRestore = redoStack.pop()!;

    historyRef.current = { undoStack, redoStack };
    syncState();

    return stateToRestore;
  }, [maxSize, syncState]);

  return {
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
