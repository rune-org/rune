import type { RtesExecutionDocument } from "@/lib/api/rtes";
import type {
  ExecutionState,
  WorkflowExecutionStatus,
  NodeExecutionData,
  WorkflowGraphSnapshot,
} from "../types/execution";
import { parseNodeStatus } from "../types/execution";
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
      error: undefined,
      credential_type: undefined,
      position,
    } as WorkflowNode);

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

/**
 * Convert RTES ExecutionDocument to frontend ExecutionState
 */
export function rtesDocToExecutionState(doc: RtesExecutionDocument): ExecutionState {
  const nodesMap = new Map<string, NodeExecutionData>();

  // Convert nodes from RTES format
  for (const [nodeId, hydratedNode] of Object.entries(doc.nodes)) {
    const latest = hydratedNode.latest;
    if (latest) {
      nodesMap.set(nodeId, {
        nodeId,
        status: parseNodeStatus(latest.status),
        output: latest.output,
        error: latest.error
          ? { message: latest.error.message, code: latest.error.code }
          : undefined,
        executedAt: latest.executed_at,
        durationMs: latest.duration_ms,
      });
    }
  }

  const graphSnapshot = extractGraphSnapshot(doc);

  return {
    executionId: doc.execution_id,
    workflowId: parseInt(doc.workflow_id, 10),
    status: (doc.status as WorkflowExecutionStatus) || "idle",
    nodes: nodesMap,
    startedAt: doc.created_at,
    isHistorical: true,
    graphSnapshot,
  };
}
