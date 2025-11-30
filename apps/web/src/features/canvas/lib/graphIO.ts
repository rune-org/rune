import type { Edge as RFEdge, Node as RFNode } from "@xyflow/react";
import type { CSSProperties } from "react";
import { nodeTypes } from "@/features/canvas/nodes";
import {
  SWITCH_FALLBACK_HANDLE_ID,
  SWITCH_RULE_HANDLE_PREFIX,
  switchHandleIdFromLabel,
  switchHandleLabelFromId,
} from "../utils/switchHandles";

export type RFGraph = { nodes: RFNode[]; edges: RFEdge[] };

/**
 * Strips credential data from nodes to prevent sensitive data from being exported.
 * Returns a new graph with credentials cleared from all nodes.
 */
export function stripCredentials(graph: RFGraph): RFGraph {
  const nodes = graph.nodes.map((node) => {
    if (node.data && typeof node.data === "object" && "credential" in node.data) {
      const { credential: _, ...restData } = node.data as Record<string, unknown>;
      return {
        ...node,
        data: restData,
      };
    }
    return node;
  });
  return { nodes, edges: graph.edges };
}

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
    const label = (e as RFEdge & EdgeMeta).label;
    const switchHandle =
      sh && typeof sh === "string" && sh.startsWith(SWITCH_RULE_HANDLE_PREFIX)
        ? sh
        : sh === SWITCH_FALLBACK_HANDLE_ID
          ? sh
          : switchHandleIdFromLabel(label);

    if (sh === "true" || sh === "false") {
      const isTrue = sh === "true";
      const edgeLabel = label ?? sh;
      const labelStyle =
        (e as RFEdge & EdgeMeta).labelStyle ?? {
          fill: "white",
          fontWeight: 600,
        };
      const labelBgStyle =
        (e as RFEdge & EdgeMeta).labelBgStyle ?? {
          fill: isTrue ? "hsl(142 70% 45%)" : "hsl(0 70% 50%)",
        };
      const labelShowBg =
        (e as RFEdge & EdgeMeta).labelShowBg ?? true;
      const labelBgPadding =
        (e as RFEdge & EdgeMeta).labelBgPadding ?? [2, 6];
      const labelBgBorderRadius =
        (e as RFEdge & EdgeMeta).labelBgBorderRadius ?? 4;
      return {
        ...e,
        label: edgeLabel,
        labelStyle,
        labelShowBg,
        labelBgStyle,
        labelBgPadding,
        labelBgBorderRadius,
      } as RFEdge;
    }

    if (switchHandle) {
      const edgeLabel =
        switchHandleLabelFromId(switchHandle) ?? (label || switchHandle);
      const labelStyle =
        (e as RFEdge & EdgeMeta).labelStyle ?? {
          fill: "white",
          fontWeight: 600,
        };
      const labelBgStyle =
        (e as RFEdge & EdgeMeta).labelBgStyle ??
        ({
          fill:
            switchHandle === SWITCH_FALLBACK_HANDLE_ID
              ? "hsl(220 9% 55%)"
              : "hsl(211 80% 55%)",
        } as CSSProperties);
      const labelShowBg =
        (e as RFEdge & EdgeMeta).labelShowBg ?? true;
      const labelBgPadding =
        (e as RFEdge & EdgeMeta).labelBgPadding ?? [2, 6];
      const labelBgBorderRadius =
        (e as RFEdge & EdgeMeta).labelBgBorderRadius ?? 4;
      return {
        ...e,
        sourceHandle: switchHandle,
        label: edgeLabel,
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
  const sanitized = stripCredentials(graph);
  return JSON.stringify(sanitized, null, 2);
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
