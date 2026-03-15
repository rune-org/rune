import type { WorkflowDetail } from "@/client/types.gen";
import { bulkWorkflowOperation } from "@/lib/api/workflows";
import { stripCredentialsFromWorkflowData } from "@/lib/workflow-dsl";
import type { WorkflowSummary } from "@/lib/workflows";

type ExportableWorkflow = Pick<WorkflowSummary, "id" | "name">;

export function buildWorkflowExportFile(workflow: ExportableWorkflow, detail: WorkflowDetail): {
  blob: Blob;
  fileName: string;
} {
  const workflowId = Number(workflow.id);
  if (!Number.isFinite(workflowId)) {
    throw new Error("Invalid workflow ID");
  }

  const rawData = (detail.latest_version?.workflow_data ?? undefined) as
    | Record<string, unknown>
    | undefined;
  const hasGraph = rawData && Array.isArray(rawData.nodes) && Array.isArray(rawData.edges);
  if (!hasGraph) {
    throw new Error("Workflow has no graph data to export");
  }

  const { nodes, edges } = stripCredentialsFromWorkflowData(rawData);
  const payload = { nodes, edges };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const safeName = (workflow.name || "workflow").replace(/[^a-zA-Z0-9-_]/g, "_");

  return {
    blob,
    fileName: `workflow-${safeName}-${workflow.id}.json`,
  };
}

export async function bulkExportWorkflowDetails(workflowIds: number[]) {
  if (workflowIds.length === 0) {
    return {
      exported: [] as WorkflowDetail[],
      failedCount: 0,
      succeededCount: 0,
    };
  }

  const response = await bulkWorkflowOperation({
    action: "export",
    workflow_ids: workflowIds,
  });

  if (response.error || !response.data?.data) {
    throw new Error("Bulk export failed");
  }

  const result = response.data.data;
  return {
    exported: result.exported ?? [],
    failedCount: result.summary.failed,
    succeededCount: result.summary.succeeded,
  };
}

export function downloadWorkflowFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
