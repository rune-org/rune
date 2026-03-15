import type { BulkWorkflowAction, BulkWorkflowFailure, WorkflowDetail } from "@/client/types.gen";
import { bulkWorkflowOperation } from "@/lib/api/workflows";

type BulkWorkflowResult = {
  succeededIds: number[];
  failed: BulkWorkflowFailure[];
  succeededCount: number;
  failedCount: number;
  exported: WorkflowDetail[];
};

export async function runWorkflowBulkOperation(
  action: BulkWorkflowAction,
  workflowIds: number[],
): Promise<BulkWorkflowResult> {
  if (workflowIds.length === 0) {
    return {
      succeededIds: [],
      failed: [],
      succeededCount: 0,
      failedCount: 0,
      exported: [],
    };
  }

  const response = await bulkWorkflowOperation({
    action,
    workflow_ids: workflowIds,
  });

  if (response.error || !response.data?.data) {
    throw new Error(`Bulk ${action} failed`);
  }

  const result = response.data.data;
  return {
    succeededIds: result.succeeded,
    failed: result.failed,
    succeededCount: result.summary.succeeded,
    failedCount: result.summary.failed,
    exported: result.exported ?? [],
  };
}
