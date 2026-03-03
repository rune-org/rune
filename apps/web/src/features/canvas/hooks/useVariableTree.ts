"use client";

import { useMemo } from "react";
import { useGraph } from "../context/GraphContext";
import { useExecutionOptional } from "../context/ExecutionContext";
import { getUpstreamNodes } from "../lib/graphUtils";
import { getStaticOutputSchema } from "../lib/nodeOutputSchemas";
import { jsonToVariableTree, type VariableSource, type VariableTreeNode } from "../lib/variableSchema";
import type { NodeKind } from "../types";

/**
 * Merges execution data tree nodes into schema tree nodes.
 * Execution data wins.
 */
function mergeTreeNodes(
  schema: VariableTreeNode[],
  execution: VariableTreeNode[],
): VariableTreeNode[] {
  if (execution.length === 0) return schema;
  if (schema.length === 0) return execution;

  const execMap = new Map<string, VariableTreeNode>();
  for (const node of execution) {
    execMap.set(node.key, node);
  }

  const merged: VariableTreeNode[] = [];
  const seen = new Set<string>();

  // Start with execution data, it takes priority
  for (const execNode of execution) {
    seen.add(execNode.key);
    const schemaNode = schema.find((s) => s.key === execNode.key);
    if (schemaNode && execNode.children && schemaNode.children) {
      merged.push({
        ...execNode,
        children: mergeTreeNodes(schemaNode.children, execNode.children),
      });
    } else {
      merged.push(execNode);
    }
  }

  // Add schema-only nodes
  for (const schemaNode of schema) {
    if (!seen.has(schemaNode.key)) {
      merged.push(schemaNode);
    }
  }

  return merged;
}

/**
 * Hook to build a variable tree for a given node.
 * Returns VariableSource[] representing all upstream nodes' outputs.
 */
export function useVariableTree(nodeId: string): VariableSource[] {
  const { nodes, edges } = useGraph();
  const executionCtx = useExecutionOptional();

  // Extract stable identity data from nodes to avoid recomputing on drag
  const nodeIdentities = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: n.type as NodeKind,
        label: (n.data as { label?: string }).label ?? n.type,
        data: n.data,
      })),
    [nodes],
  );

  // Extract stable edge pairs
  const edgePairs = useMemo(
    () => edges.map((e) => ({ source: e.source, target: e.target })),
    [edges],
  );

  return useMemo(() => {
    const upstreamNodes = getUpstreamNodes(nodeId, nodes, edges);

    const PASS_THROUGH_KINDS = new Set<NodeKind>(["if", "switch", "wait"]);

    return upstreamNodes.map((upstreamNode) => {
      const kind = upstreamNode.type as NodeKind;
      const label =
        (upstreamNode.data as { label?: string }).label ?? kind;
      const rootPath = `$${label}`;

      const staticSchema = getStaticOutputSchema(
        kind,
        upstreamNode.data as Record<string, unknown>,
      );

      const prefixedSchema = staticSchema.map((node) => ({
        ...node,
        path: node.path.startsWith("$") ? node.path : `${rootPath}.${node.path}`,
      }));

      // Check for execution data
      let executionTree: VariableTreeNode[] = [];
      if (executionCtx) {
        const execData = executionCtx.getNodeExecution(upstreamNode.id);
        if (execData?.output !== undefined && execData.output !== null) {
          executionTree = jsonToVariableTree(execData.output, rootPath);
        }
      }

      // For control-flow (pass-through) nodes, prefer execution data when available
      // (the static schema is a hint until the node actually runs)
      let children: VariableTreeNode[];
      if (PASS_THROUGH_KINDS.has(kind)) {
        children = executionTree.length > 0 ? executionTree : prefixedSchema;
      } else {
        children = mergeTreeNodes(prefixedSchema, executionTree);
      }

      return {
        nodeId: upstreamNode.id,
        nodeLabel: label,
        nodeKind: kind,
        rootPath,
        children,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, nodeIdentities, edgePairs, executionCtx?.state.nodes]);
}
