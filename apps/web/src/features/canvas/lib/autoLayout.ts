import dagre from "dagre";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "../types";
import { getNodeDimensionsWithData } from "./nodeRegistry";

/**
 * Get the vertical order priority for a source handle.
 * Lower values = should be placed higher (smaller Y).
 */
function getHandleOrder(sourceHandle: string | null | undefined): number {
  if (!sourceHandle) return 0;
  if (sourceHandle === "true") return 0;
  if (sourceHandle === "false") return 1;
  // Switch handles: switch-case-0, switch-case-1, ..., switch-fallback
  if (sourceHandle.startsWith("switch-case-")) {
    const idx = parseInt(sourceHandle.replace("switch-case-", ""), 10);
    return isNaN(idx) ? 100 : idx;
  }
  if (sourceHandle === "switch-fallback") return Number.MAX_SAFE_INTEGER;
  return 0;
}

/**
 * Dagre layout configuration
 */
const LAYOUT_CONFIG = {
  rankdir: "LR" as const,
  nodesep: 60,
  ranksep: 120,
  edgesep: 20,
  marginx: 40,
  marginy: 40,
  ranker: "network-simplex" as const,
};

export interface AutoLayoutOptions {
  nodes: CanvasNode[];
  edges: Edge[];
  respectPinned?: boolean;
}

export interface AutoLayoutResult {
  nodes: CanvasNode[];
  edges: Edge[];
}

function getLayoutDimensions(node: CanvasNode): { width: number; height: number } {
  return getNodeDimensionsWithData(node.type, node.data);
}

/**
 * Apply auto-layout using Dagre algorithm.
 */
export function applyAutoLayout({
  nodes,
  edges,
  respectPinned = true,
}: AutoLayoutOptions): AutoLayoutResult {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const pinnedNodes = respectPinned ? nodes.filter((n) => n.data.pinned) : [];
  const unpinnedNodes = respectPinned ? nodes.filter((n) => !n.data.pinned) : nodes;

  if (unpinnedNodes.length === 0) {
    return { nodes, edges };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph(LAYOUT_CONFIG);

  nodes.forEach((node) => {
    const dimensions = getLayoutDimensions(node);
    dagreGraph.setNode(node.id, {
      width: dimensions.width,
      height: dimensions.height,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Find an anchor node to preserve the user's canvas position.
  const anchorNode =
    pinnedNodes[0] ||
    nodes.find((n) => n.type === "trigger") ||
    nodes[0];

  // Calculate offset to anchor the new layout to the existing canvas position
  const anchorDagreNode = dagreGraph.node(anchorNode.id);
  const anchorDimensions = getLayoutDimensions(anchorNode);
  const offsetX = anchorNode.position.x - (anchorDagreNode.x - anchorDimensions.width / 2); // Center co-ords to top-left conversion
  const offsetY = anchorNode.position.y - (anchorDagreNode.y - anchorDimensions.height / 2);

  const layoutedNodes = nodes.map((node) => {
    if (respectPinned && node.data.pinned) {
      return node;
    }

    const dagreNode = dagreGraph.node(node.id);
    if (!dagreNode) return node;

    const dimensions = getLayoutDimensions(node);

    return {
      ...node,
      position: {
        // Apply offset so layout stays anchored to existing canvas region
        x: dagreNode.x - dimensions.width / 2 + offsetX,
        y: dagreNode.y - dimensions.height / 2 + offsetY,
      },
    };
  });

  const reorderedNodes = reorderSiblingNodes(layoutedNodes, edges);

  // Resolve any remaining overlaps
  const nonOverlappingNodes = resolveAllOverlaps(reorderedNodes);

  return adjustForPinnedOverlaps(nonOverlappingNodes, edges, pinnedNodes);
}

/**
 * Resolve overlaps between nodes 
 * Groups nodes by approximate X position (rank), then ensures no vertical overlap within each group.
 */
function resolveAllOverlaps(nodes: CanvasNode[]): CanvasNode[] {
  const PADDING = 20;
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));

  // Group nodes by approximate X position (within ranksep/2 = 60px are considered same rank)
  const rankTolerance = 60;
  const ranks: CanvasNode[][] = [];

  for (const node of nodes) {
    const nodeX = node.position.x;
    let foundRank = false;

    for (const rank of ranks) {
      const rankX = rank[0].position.x;
      if (Math.abs(nodeX - rankX) < rankTolerance) {
        rank.push(node);
        foundRank = true;
        break;
      }
    }

    if (!foundRank) {
      ranks.push([node]);
    }
  }

  // For each rank, sort by Y and resolve overlaps
  for (const rank of ranks) {
    if (rank.length < 2) continue;

    // Sort by current Y position
    rank.sort((a, b) => a.position.y - b.position.y);

    // Ensure no overlaps: each node must start after the previous ends
    for (let i = 1; i < rank.length; i++) {
      const prevNode = nodeMap.get(rank[i - 1].id)!;
      const currNode = nodeMap.get(rank[i].id)!;

      const prevDimensions = getLayoutDimensions(prevNode);
      const prevBottom = prevNode.position.y + prevDimensions.height + PADDING;
      const currTop = currNode.position.y;

      if (currTop < prevBottom) {
        // Overlap detected, push current node down
        nodeMap.set(currNode.id, {
          ...currNode,
          position: {
            ...currNode.position,
            y: prevBottom,
          },
        });
      }
    }
  }

  return nodes.map((n) => nodeMap.get(n.id) || n);
}

/**
 * Reorder nodes that share the same source node to match handle vertical order.
 * This ensures "true" branch nodes are above "false" branch nodes, etc.
 */
function reorderSiblingNodes(nodes: CanvasNode[], edges: Edge[]): CanvasNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Group edges by source node
  const edgesBySource = new Map<string, Edge[]>();
  for (const edge of edges) {
    const sourceId = edge.source;
    if (!edgesBySource.has(sourceId)) {
      edgesBySource.set(sourceId, []);
    }
    edgesBySource.get(sourceId)!.push(edge);
  }

  // For each source with multiple outgoing edges, reorder target nodes
  for (const [sourceId, sourceEdges] of edgesBySource) {
    if (sourceEdges.length < 2) continue;

    const sourceNode = nodeMap.get(sourceId);
    if (!sourceNode) continue;

    // Only reorder for branching nodes (if, switch)
    if (sourceNode.type !== "if" && sourceNode.type !== "switch") continue;

    const targets = sourceEdges
      .map((edge) => ({
        nodeId: edge.target,
        handleOrder: getHandleOrder(edge.sourceHandle),
        node: nodeMap.get(edge.target),
      }))
      .filter((t) => t.node && !t.node.data.pinned)
      .sort((a, b) => a.handleOrder - b.handleOrder);

    if (targets.length < 2) continue;

    const currentYPositions = targets
      .map((t) => t.node!.position.y)
      .sort((a, b) => a - b);

    targets.forEach((target, idx) => {
      const node = nodeMap.get(target.nodeId);
      if (node) {
        nodeMap.set(target.nodeId, {
          ...node,
          position: {
            ...node.position,
            y: currentYPositions[idx],
          },
        });
      }
    });
  }

  return nodes.map((n) => nodeMap.get(n.id) || n);
}

/**
 * Adjust unpinned nodes to avoid overlapping with pinned nodes.
 * (when a user pins a node, other nodes shouldn't overlap it.)
 */
function adjustForPinnedOverlaps(
  nodes: CanvasNode[],
  edges: Edge[],
  pinnedNodes: CanvasNode[],
): AutoLayoutResult {
  if (pinnedNodes.length === 0) {
    return { nodes, edges };
  }

  const adjustedNodes = nodes.map((node) => {
    if (node.data.pinned) return node;

    let adjustedPosition = { ...node.position };
    const dimensions = getLayoutDimensions(node);
    const padding = 20;

    for (const pinnedNode of pinnedNodes) {
      const pinnedDimensions = getLayoutDimensions(pinnedNode);

      const nodeLeft = adjustedPosition.x;
      const nodeRight = adjustedPosition.x + dimensions.width;
      const nodeTop = adjustedPosition.y;
      const nodeBottom = adjustedPosition.y + dimensions.height;

      const pinnedLeft = pinnedNode.position.x - padding;
      const pinnedRight = pinnedNode.position.x + pinnedDimensions.width + padding;
      const pinnedTop = pinnedNode.position.y - padding;
      const pinnedBottom = pinnedNode.position.y + pinnedDimensions.height + padding;

      const overlapsX = nodeLeft < pinnedRight && nodeRight > pinnedLeft;
      const overlapsY = nodeTop < pinnedBottom && nodeBottom > pinnedTop;

      if (overlapsX && overlapsY) {
        adjustedPosition = {
          ...adjustedPosition,
          x: pinnedRight + padding,
        };
      }
    }

    return {
      ...node,
      position: adjustedPosition,
    };
  });

  return { nodes: adjustedNodes, edges };
}
