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
  /**
   * Status: active (scheduled + is_active=true), inactive (scheduled + is_active=false), draft (manual or no schedule)
   */
  status: "active" | "inactive" | "draft";
  /**
   * Trigger type.
   */
  triggerType: string;
  /**
   * Schedule information if the workflow is scheduled.
   */
  schedule?: {
    is_active: boolean;
    interval_seconds: number;
    start_at?: string;
  };
  /**
   * Last run timestamp.
   */
  lastRunAt: string | null;
  /**
   * Run status.
   */
  lastRunStatus: "success" | "failed" | "running" | "n/a";
  /**
   * Total run count.
   */
  runs: number;
};

export const defaultWorkflowSummary: WorkflowSummary = {
  id: "",
  name: "Untitled Workflow",
  status: "draft",
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
  
  const lastRunAt = item.schedule?.last_run_at ?? null;
  const runs = item.schedule?.run_count ?? 0;
  const lastRunStatus = item.schedule?.last_error 
    ? "failed" 
    : lastRunAt 
    ? "success" 
    : "n/a";
  
  // Determine status: active (scheduled + active), inactive (scheduled + not active), draft (manual)
  let status: "active" | "inactive" | "draft" = "draft";
  if (item.trigger_type === "scheduled") {
    status = item.schedule?.is_active ? "active" : "inactive";
  }
  
  return {
    ...defaultWorkflowSummary,
    id: String(item.id),
    name: item.name,
    status,
    triggerType,
    lastRunAt,
    lastRunStatus,
    runs,
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
