import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "../types";

/**
 * Reverse BFS to find all upstream nodes for a given node.
 * Returns topologically ordered upstream nodes (closest first), excluding self.
 * Cycle-safe via visited Set.
 */
export function getUpstreamNodes(
  nodeId: string,
  nodes: CanvasNode[],
  edges: Edge[],
): CanvasNode[] {
  // Build adjacency map: target → source[]
  const incomingMap = new Map<string, string[]>();
  for (const edge of edges) {
    const sources = incomingMap.get(edge.target);
    if (sources) {
      sources.push(edge.source);
    } else {
      incomingMap.set(edge.target, [edge.source]);
    }
  }

  // BFS backwards from nodeId
  const visited = new Set<string>();
  const queue: string[] = [];
  const result: CanvasNode[] = [];

  // Index nodes by id for O(1) lookup
  const nodeMap = new Map<string, CanvasNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Seed queue with direct parents
  const initialSources = incomingMap.get(nodeId);
  if (initialSources) {
    for (const src of initialSources) {
      if (!visited.has(src)) {
        visited.add(src);
        queue.push(src);
      }
    }
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodeMap.get(currentId);
    if (currentNode) {
      result.push(currentNode);
    }

    const sources = incomingMap.get(currentId);
    if (sources) {
      for (const src of sources) {
        if (!visited.has(src)) {
          visited.add(src);
          queue.push(src);
        }
      }
    }
  }

  return result;
}
