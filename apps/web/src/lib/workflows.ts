import type { WorkflowListItem, WorkflowDetail, WorkflowVersionDetail } from "@/client/types.gen";
import type { CanvasNode, CanvasEdge } from "@/features/canvas/types";
import type {
  WorkflowNode as WorkflowNodeDSL,
  WorkflowEdge as WorkflowEdgeDSL,
} from "@/lib/workflow-dsl";
import { canvasToWorkflowData, workflowDataToCanvas } from "@/lib/workflow-dsl";
import type { WorkflowRole } from "@/lib/permissions";

/**
 * UI-friendly summary of a workflow row (in the table view).
 * The backend currently only exposes minimal fields, so we derive
 * placeholder values for items like status metadata until richer data arrives.
 */
export type WorkflowSummary = {
  id: string;
  name: string;
  /**
   * Workflow description.
   */
  description?: string | null;
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
  /**
   * User's role for this workflow (controls permissions).
   */
  role: WorkflowRole;
  /**
   * Latest version number (if versioning is active).
   */
  latestVersion?: number;
  /**
   * Whether the workflow has unpublished changes.
   */
  hasUnpublishedChanges?: boolean;
};

export const defaultWorkflowSummary: WorkflowSummary = {
  id: "",
  name: "Untitled Workflow",
  status: "draft",
  triggerType: "Manual",
  lastRunAt: null,
  lastRunStatus: "n/a",
  runs: 0,
  role: "owner",
};

export function listItemToWorkflowSummary(item: WorkflowListItem): WorkflowSummary {
  return {
    ...defaultWorkflowSummary,
    id: String(item.id),
    name: item.name,
    description: item.description,
    status: item.is_active ? "active" : "draft",
    role: item.role,
  };
}

export type WorkflowGraph = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

function workflowDataToGraph(raw: Record<string, unknown>): WorkflowGraph {
  const data = raw as {
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

export function detailToGraph(detail: WorkflowDetail): WorkflowGraph {
  const raw = detail.latest_version?.workflow_data ?? {};
  return workflowDataToGraph(raw as Record<string, unknown>);
}

export function versionToGraph(version: WorkflowVersionDetail): WorkflowGraph {
  return workflowDataToGraph((version.workflow_data ?? {}) as Record<string, unknown>);
}

export function graphToWorkflowData(graph: WorkflowGraph): Record<string, unknown> {
  return canvasToWorkflowData(graph.nodes, graph.edges);
}
