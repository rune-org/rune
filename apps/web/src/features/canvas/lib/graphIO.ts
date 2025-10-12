import type { Edge as RFEdge, Node as RFNode } from "@xyflow/react";
import type { CSSProperties } from "react";
import { nodeTypes } from "@/features/canvas/nodes";

export type RFGraph = { nodes: RFNode[]; edges: RFEdge[] };

type EdgeMeta = {
  sourceHandle?: string;
  label?: string;
  labelStyle?: CSSProperties;
  labelShowBg?: boolean;
  labelBgStyle?: CSSProperties;
  labelBgPadding?: [number, number];
  labelBgBorderRadius?: number;
};

export function allowedTypeSet(): Set<string> {
  return new Set(Object.keys(nodeTypes));
}

export function sanitizeGraph(
  graph: RFGraph,
  allowed = allowedTypeSet(),
): RFGraph {
  const nodes = (graph.nodes ?? []).filter(
    (n) => n && typeof n.id === "string" && allowed.has(String(n.type || "")),
  );
  const idSet = new Set(nodes.map((n) => n.id));
  const rawEdges = (graph.edges ?? []).filter(
    (e) =>
      e &&
      typeof e.id === "string" &&
      idSet.has(String(e.source)) &&
      idSet.has(String(e.target)),
  );

  const edges = rawEdges.map((e) => {
    const sh = (e as RFEdge & EdgeMeta).sourceHandle;
    if (sh === "true" || sh === "false") {
      const isTrue = sh === "true";
      const label = (e as RFEdge & EdgeMeta).label ?? sh;
      const labelStyle = (e as RFEdge & EdgeMeta).labelStyle ?? {
        fill: "white",
        fontWeight: 600,
      };
      const labelBgStyle = (e as RFEdge & EdgeMeta).labelBgStyle ?? {
        fill: isTrue ? "hsl(142 70% 45%)" : "hsl(0 70% 50%)",
      };
      const labelShowBg = (e as RFEdge & EdgeMeta).labelShowBg ?? true;
      const labelBgPadding = (e as RFEdge & EdgeMeta).labelBgPadding ?? [2, 6];
      const labelBgBorderRadius =
        (e as RFEdge & EdgeMeta).labelBgBorderRadius ?? 4;
      return {
        ...e,
        label,
        labelStyle,
        labelShowBg,
        labelBgStyle,
        labelBgPadding,
        labelBgBorderRadius,
      } as RFEdge;
    }
    return e;
  });

  return { nodes, edges };
}

export function stringifyGraph(graph: RFGraph): string {
  return JSON.stringify(graph, null, 2);
}

export function tryParseGraphFromText(text: string): RFGraph | null {
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) return null;
    return sanitizeGraph({ nodes: obj.nodes, edges: obj.edges });
  } catch {
    return null;
  }
}
