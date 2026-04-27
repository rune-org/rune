import type { RtesExecutionDocument } from "@/lib/api/rtes";
import type {
  ExecutionState,
  WorkflowExecutionStatus,
  NodeExecutionData,
  WorkflowGraphSnapshot,
} from "../types/execution";
import { parseNodeStatus } from "../types/execution";
import type { RtesNodeExecutionInstance } from "@/lib/api/rtes";
import { workflowDataToCanvas, type WorkflowNode, type WorkflowEdge } from "@/lib/workflow-dsl";
import { sanitizeGraph } from "./graphIO";
import { applyAutoLayout } from "./autoLayout";
import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

/**
 * Extract a graph snapshot from an RTES execution document.
 * Converts the stored node definitions and edges back into React Flow format.
 */
export function extractGraphSnapshot(
  doc: RtesExecutionDocument,
): WorkflowGraphSnapshot | undefined {
  if (!doc.nodes || Object.keys(doc.nodes).length === 0) return undefined;

  let hasStoredPositions = false;
  const workflowNodes: WorkflowNode[] = [];
  for (const [nodeId, hydratedNode] of Object.entries(doc.nodes)) {
    // Fall back to latest execution instance fields when top-level fields are empty
    const extra = hydratedNode as Record<string, unknown>;
    const latest = hydratedNode.latest;

    const name = (extra.name as string) || latest?.name || nodeId;
    const type = (extra.type as string) || latest?.node_type || "agent";
    const trigger = (extra.trigger as boolean) ?? false;
    const position = extra.position as [number, number] | undefined;

    if (position != null) hasStoredPositions = true;

    workflowNodes.push({
      id: nodeId,
      name,
      type,
      trigger,
      parameters: (extra.parameters as Record<string, unknown>) ?? {},
      output: (extra.output as Record<string, unknown>) ?? {},
      position,
    });
  }

  const workflowEdges: WorkflowEdge[] = (doc.edges ?? []).map((e) => ({
    id: e.id,
    src: e.src,
    dst: e.dst,
    label: e.label,
  }));

  const { nodes: canvasNodes, edges: canvasEdges } = workflowDataToCanvas({
    nodes: workflowNodes,
    edges: workflowEdges,
  });

  const sanitized = sanitizeGraph({ nodes: canvasNodes, edges: canvasEdges });

  // Use stored positions when available, we fall back to auto-layout
  // for executions that were stored before positions were persisted.
  if (!hasStoredPositions && sanitized.nodes.length > 1) {
    const layouted = applyAutoLayout({
      nodes: sanitized.nodes as CanvasNode[],
      edges: sanitized.edges as Edge[],
      respectPinned: false,
    });
    return {
      nodes: layouted.nodes as CanvasNode[],
      edges: layouted.edges as Edge[],
    };
  }

  return {
    nodes: sanitized.nodes as CanvasNode[],
    edges: sanitized.edges as Edge[],
  };
}

function rtesInstanceToNodeExecution(
  nodeId: string,
  instance: RtesNodeExecutionInstance,
  lineageHash?: string,
): NodeExecutionData {
  return {
    nodeId,
    status: parseNodeStatus(instance.status),
    input: instance.input,
    output: instance.output,
    parameters: instance.parameters,
    error: instance.error
      ? {
          message: instance.error.message,
          code: instance.error.code,
          details: instance.error.details,
        }
      : undefined,
    executedAt: instance.executed_at,
    durationMs: instance.duration_ms,
    lineageHash: instance.lineage_hash ?? lineageHash,
    splitNodeId: instance.split_node_id ?? undefined,
    branchId: instance.branch_id ?? undefined,
    itemIndex: instance.item_index ?? undefined,
    totalItems: instance.total_items ?? undefined,
  };
}

/**
 * Convert RTES ExecutionDocument to frontend ExecutionState
 */
export function rtesDocToExecutionState(doc: RtesExecutionDocument): ExecutionState {
  const nodesMap = new Map<string, NodeExecutionData>();
  const nodeExecutionsMap = new Map<string, NodeExecutionData[]>();

  // Convert nodes from RTES format
  for (const [nodeId, hydratedNode] of Object.entries(doc.nodes)) {
    const lineageExecutions = Object.entries(hydratedNode.lineages ?? {}).map(
      ([lineageHash, instance]) => rtesInstanceToNodeExecution(nodeId, instance, lineageHash),
    );
    if (lineageExecutions.length > 0) {
      nodeExecutionsMap.set(nodeId, lineageExecutions);
    }

    const latest = hydratedNode.latest;
    if (latest) {
      const latestExecution = rtesInstanceToNodeExecution(nodeId, latest);
      nodesMap.set(nodeId, latestExecution);
      if (lineageExecutions.length === 0) {
        nodeExecutionsMap.set(nodeId, [latestExecution]);
      }
    }
  }

  const graphSnapshot = extractGraphSnapshot(doc);

  return {
    executionId: doc.execution_id,
    workflowId: parseInt(doc.workflow_id, 10),
    status: (doc.status as WorkflowExecutionStatus) || "idle",
    nodes: nodesMap,
    nodeExecutions: nodeExecutionsMap,
    startedAt: doc.created_at,
    isHistorical: true,
    graphSnapshot,
  };
}
