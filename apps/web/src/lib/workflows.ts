import type { WorkflowListItem, WorkflowDetail, TriggerType } from "@/client/types.gen";
import type { CanvasNode, CanvasEdge } from "@/features/canvas/types";
import type {
  WorkflowNode as WorkflowNodeDSL,
  WorkflowEdge as WorkflowEdgeDSL,
} from "@/lib/workflow-dsl";
import {
  canvasToWorkflowData,
  workflowDataToCanvas,
} from "@/lib/workflow-dsl";
import type { WorkflowRole } from "@/lib/permissions";

/**
 * UI-friendly summary of a workflow row (in the table view).
 */
export type WorkflowSummary = {
  id: string;
  name: string;
  triggerType: TriggerType;
  /** Whether a scheduled workflow's schedule is active. */
  scheduleActive: boolean | null;
  lastRunAt: string | null;
  lastRunStatus: "success" | "failed" | "running" | "n/a";
  runs: number;
  role: WorkflowRole;
};

export const defaultWorkflowSummary: WorkflowSummary = {
  id: "",
  name: "Untitled Workflow",
  triggerType: "manual",
  scheduleActive: null,
  lastRunAt: null,
  lastRunStatus: "n/a",
  runs: 0,
  role: "owner",
};

export function listItemToWorkflowSummary(
  item: WorkflowListItem,
): WorkflowSummary {
  return {
    ...defaultWorkflowSummary,
    id: String(item.id),
    name: item.name,
    triggerType: item.trigger_type ?? "manual",
    scheduleActive: item.schedule?.is_active ?? null,
    role: item.role,
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
