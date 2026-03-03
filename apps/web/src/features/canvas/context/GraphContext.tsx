"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "../types";

interface GraphContextValue {
  nodes: CanvasNode[];
  edges: Edge[];
}

const GraphContext = createContext<GraphContextValue | null>(null);

export function GraphProvider({
  nodes,
  edges,
  children,
}: GraphContextValue & { children: ReactNode }) {
  return (
    <GraphContext.Provider value={{ nodes, edges }}>
      {children}
    </GraphContext.Provider>
  );
}

export function useGraph(): GraphContextValue {
  const context = useContext(GraphContext);
  if (!context) {
    throw new Error("useGraph must be used within a GraphProvider");
  }
  return context;
}

export function useGraphOptional(): GraphContextValue | null {
  return useContext(GraphContext);
}
