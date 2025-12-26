import type { WorkflowListItem, WorkflowDetail } from "@/client/types.gen";
import type { CanvasNode, CanvasEdge } from "@/features/canvas/types";
import type {
  WorkflowNode as WorkflowNodeDSL,
  WorkflowEdge as WorkflowEdgeDSL,
} from "@/lib/workflow-dsl";
import {
  canvasToWorkflowData,
  workflowDataToCanvas,
} from "@/lib/workflow-dsl";

/**
 * UI-friendly summary of a workflow row (in the table view).
 * The backend currently only exposes minimal fields, so we derive
 * placeholder values for items like status metadata until richer data arrives.
 */
export type WorkflowSummary = {
  id: string;
  name: string;
  status: "active" | "inactive";
  /**
   * Trigger type.
   */
  triggerType: string;
  /**
   * Schedule information if the workflow is scheduled.
   * Only contains is_active status. Full schedule details are fetched from workflow detail endpoint.
   */
  schedule?: {
    is_active: boolean;
  };
  /**
   * Last run timestamp - will be fetched from RTES (execution service).
   */
  lastRunAt: string | null;
  /**
   * Run status - will be fetched from RTES (execution service).
   */
  lastRunStatus: "success" | "failed" | "running" | "n/a";
  /**
   * Total run count - will be fetched from RTES (execution service).
   */
  runs: number;
};

export const defaultWorkflowSummary: WorkflowSummary = {
  id: "",
  name: "Untitled Workflow",
  status: "inactive",
  triggerType: "Manual",
  lastRunAt: null,
  lastRunStatus: "n/a",
  runs: 0,
};

export function listItemToWorkflowSummary(
  item: WorkflowListItem,
): WorkflowSummary {
  const triggerType = item.trigger_type === "scheduled" 
    ? "Scheduled" 
    : item.trigger_type === "webhook" 
    ? "Webhook" 
    : "Manual";
  
  // Determine status based on is_active flag (defaults to inactive if no schedule)
  const status = item.schedule?.is_active ? "active" : "inactive";
  
  return {
    ...defaultWorkflowSummary,
    id: String(item.id),
    name: item.name,
    status,
    triggerType,
    schedule: item.schedule ? {
      is_active: item.schedule.is_active,
    } : undefined,
    lastRunAt: null,
    lastRunStatus: "n/a",
  };
}

export type WorkflowGraph = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export function detailToGraph(detail: WorkflowDetail): WorkflowGraph {
  const data = (detail.workflow_data ?? {}) as {
    nodes?: WorkflowNodeDSL[] | undefined;
    edges?: WorkflowEdgeDSL[] | undefined;
  };
  const { nodes, edges } = workflowDataToCanvas({
    nodes: Array.isArray(data.nodes) ? data.nodes : [],
    edges: Array.isArray(data.edges) ? data.edges : [],
  });

  return {
    nodes: nodes as CanvasNode[],
    edges: edges as CanvasEdge[],
  };
}

export function graphToWorkflowData(graph: WorkflowGraph): Record<string, unknown> {
  return canvasToWorkflowData(graph.nodes, graph.edges);
}
