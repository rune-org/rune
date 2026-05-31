"use client";

import { useMemo } from "react";
import { useGraph } from "../context/GraphContext";
import { useExecutionOptional } from "../context/ExecutionContext";
import { getUpstreamNodes } from "../lib/graphUtils";
import { getStaticOutputSchema } from "../lib/nodeOutputSchemas";
import {
  jsonToVariableTree,
  type VariableSource,
  type VariableTreeNode,
} from "../lib/variableSchema";
import type { CanvasNode, NodeKind } from "../types";

const WORKING_JSON_KINDS = new Set<NodeKind>(["edit", "filter", "sort", "limit"]);

function variableTypeForValue(value: unknown): VariableTreeNode["type"] {
  if (value === null || value === undefined) return "unknown";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

function arrayLengthForValue(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

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

function prefixTreePaths(nodes: VariableTreeNode[], rootPath: string): VariableTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    path: node.path.startsWith("$") ? node.path : `${rootPath}.${node.path}`,
    children: node.children ? prefixTreePaths(node.children, rootPath) : undefined,
  }));
}

function itemTreeFromItems(items: unknown[], parentPath: string): VariableTreeNode[] {
  let merged: VariableTreeNode[] = [];
  for (const item of items) {
    const itemChildren = jsonToVariableTree(item, parentPath);
    merged = mergeTreeNodes(merged, itemChildren);
  }
  return merged;
}

function buildSplitItemNode(items: unknown[] | undefined): VariableTreeNode {
  const firstItem = items?.[0];
  return {
    key: "$item",
    path: "$item",
    type: variableTypeForValue(firstItem),
    arrayLength: arrayLengthForValue(firstItem),
    source: items && items.length > 0 ? "execution" : "schema",
    children: items && items.length > 0 ? itemTreeFromItems(items, "$item") : undefined,
  };
}

function splitItemsFromExecution(output: unknown): unknown[] | undefined {
  if (!output || typeof output !== "object") return undefined;
  const items = (output as Record<string, unknown>)["_split_items"];
  return Array.isArray(items) ? items : undefined;
}

function createWorkingJsonSource(
  upstreamNodes: CanvasNode[],
  executionCtx: ReturnType<typeof useExecutionOptional>,
): VariableSource | null {
  if (!executionCtx) return null;

  for (const upstreamNode of upstreamNodes) {
    const kind = upstreamNode.type as NodeKind;
    if (!WORKING_JSON_KINDS.has(kind)) continue;

    const execData = executionCtx.getNodeExecution(upstreamNode.id);
    const output = execData?.output;
    if (!output || typeof output !== "object" || !("$json" in output)) continue;

    const jsonValue = (output as Record<string, unknown>)["$json"];
    return {
      nodeId: `${upstreamNode.id}:$json`,
      nodeLabel: "$json",
      nodeKind: kind,
      rootPath: "$json",
      children: [
        {
          key: "$json",
          path: "$json",
          type: variableTypeForValue(jsonValue),
          arrayLength: arrayLengthForValue(jsonValue),
          source: "execution",
          children: jsonToVariableTree(jsonValue, "$json"),
        },
      ],
    };
  }

  return null;
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

    const sources = upstreamNodes.map((upstreamNode) => {
      const kind = upstreamNode.type as NodeKind;
      const label = (upstreamNode.data as { label?: string }).label ?? kind;
      const rootPath = `$${label}`;

      const staticSchema = getStaticOutputSchema(
        kind,
        upstreamNode.data as Record<string, unknown>,
      );

      const prefixedSchema = prefixTreePaths(staticSchema, rootPath);

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
      } else if (kind === "split") {
        const splitItems = splitItemsFromExecution(
          executionCtx?.getNodeExecution(upstreamNode.id)?.output,
        );
        const itemNode = buildSplitItemNode(splitItems);
        children = mergeTreeNodes([itemNode], executionTree);
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

    const workingJsonSource = createWorkingJsonSource(upstreamNodes, executionCtx);
    return workingJsonSource ? [workingJsonSource, ...sources] : sources;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, nodeIdentities, edgePairs, executionCtx?.state.nodes]);
}
