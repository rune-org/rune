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
 * Workflow role types matching backend WorkflowRole enum
 */
export type WorkflowRole = "owner" | "editor" | "viewer";

/**
 * UI-friendly summary of a workflow row (in the table view).
 * The backend currently only exposes minimal fields, so we derive
 * placeholder values for items like status metadata until richer data arrives.
 */
export type WorkflowSummary = {
  id: string;
  name: string;
  /**
   * User's role for this workflow (determines permissions)
   */
  role: WorkflowRole;
  /**
   * Derived status – treated as active when `is_active` is true, otherwise draft.
   */
  status: "active" | "draft";
  /**
   * Placeholder trigger type.
   */
  triggerType: string;
  /**
   * Placeholder last run timestamp.
   */
  lastRunAt: string | null;
  /**
   * Placeholder run status.
   */
  lastRunStatus: "success" | "failed" | "running" | "n/a";
  /**
   * Placeholder total run count.
   */
  runs: number;
};

export const defaultWorkflowSummary: WorkflowSummary = {
  id: "",
  name: "Untitled Workflow",
  role: "viewer",
  status: "draft",
  triggerType: "Manual",
  lastRunAt: null,
  lastRunStatus: "n/a",
  runs: 0,
};

export function listItemToWorkflowSummary(
  item: WorkflowListItem,
): WorkflowSummary {
  // For now, extract role from item if available, otherwise default to "owner"
  // Once backend is updated, this will use item.role directly
  const role: WorkflowRole = (item as any).role || "owner";
  
  return {
    ...defaultWorkflowSummary,
    id: String(item.id),
    name: item.name,
    role,
    status: item.is_active ? "active" : "draft",
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