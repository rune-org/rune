import {
  bulkWorkflowOperationWorkflowsBulkPost,
  listWorkflowsWorkflowsGet,
  getWorkflowWorkflowsWorkflowIdGet,
  createWorkflowWorkflowsPost,
  updateNameWorkflowsWorkflowIdNamePut,
  updateStatusWorkflowsWorkflowIdStatusPut,
  deleteWorkflowWorkflowsWorkflowIdDelete,
  runWorkflowWorkflowsWorkflowIdRunPost,
  listUserExecutionsExecutionsGet,
  getWorkflowExecutionsExecutionsWorkflowsWorkflowIdGet,
  getExecutionExecutionsWorkflowsWorkflowIdExecutionIdGet,
  listWorkflowVersionsWorkflowsWorkflowIdVersionsGet,
  createWorkflowVersionWorkflowsWorkflowIdVersionsPost,
  getWorkflowVersionWorkflowsWorkflowIdVersionsVersionIdGet,
  publishWorkflowVersionWorkflowsWorkflowIdPublishPost,
  restoreWorkflowVersionWorkflowsWorkflowIdRestoreVersionIdPost,
} from "@/client";

import type {
  WorkflowCreate,
  WorkflowUpdateName,
  WorkflowUpdateStatus,
  WorkflowCreateVersion,
  WorkflowPublishVersion,
  WorkflowRestoreVersion,
  WorkflowRunRequest,
  BulkWorkflowRequest,
  ListWorkflowsWorkflowsGetResponse,
  GetWorkflowWorkflowsWorkflowIdGetResponse,
  CreateWorkflowWorkflowsPostResponse,
  UpdateNameWorkflowsWorkflowIdNamePutResponse,
  UpdateStatusWorkflowsWorkflowIdStatusPutResponse,
  DeleteWorkflowWorkflowsWorkflowIdDeleteResponse,
  RunWorkflowWorkflowsWorkflowIdRunPostResponse,
  ListUserExecutionsExecutionsGetResponse,
  GetWorkflowExecutionsExecutionsWorkflowsWorkflowIdGetResponse,
  GetExecutionExecutionsWorkflowsWorkflowIdExecutionIdGetResponse,
  ListWorkflowVersionsWorkflowsWorkflowIdVersionsGetResponse,
  CreateWorkflowVersionWorkflowsWorkflowIdVersionsPostResponse,
  GetWorkflowVersionWorkflowsWorkflowIdVersionsVersionIdGetResponse,
  PublishWorkflowVersionWorkflowsWorkflowIdPublishPostResponse,
  RestoreWorkflowVersionWorkflowsWorkflowIdRestoreVersionIdPostResponse,
  BulkWorkflowOperationWorkflowsBulkPostResponse,
} from "@/client/types.gen";

// Readable wrappers for workflow-related SDK functions

export const listWorkflows = () => listWorkflowsWorkflowsGet();

export const listUserExecutions = () => listUserExecutionsExecutionsGet();

export const getWorkflowById = (workflow_id: number) =>
  getWorkflowWorkflowsWorkflowIdGet({ path: { workflow_id } });

export const createWorkflow = (payload: WorkflowCreate) =>
  createWorkflowWorkflowsPost({ body: payload });

export const updateWorkflowName = (workflow_id: number, name: string) =>
  updateNameWorkflowsWorkflowIdNamePut({
    path: { workflow_id },
    body: { name } as WorkflowUpdateName,
  });

export const updateWorkflowStatus = (workflow_id: number, is_active: boolean) =>
  updateStatusWorkflowsWorkflowIdStatusPut({
    path: { workflow_id },
    body: { is_active } as WorkflowUpdateStatus,
  });

export const deleteWorkflow = (workflow_id: number) =>
  deleteWorkflowWorkflowsWorkflowIdDelete({ path: { workflow_id } });

export const runWorkflow = (workflow_id: number, version_id?: number) =>
  runWorkflowWorkflowsWorkflowIdRunPost({
    path: { workflow_id },
    body: version_id != null ? ({ version_id } as WorkflowRunRequest) : null,
  });

export const bulkWorkflowOperation = (payload: BulkWorkflowRequest) =>
  bulkWorkflowOperationWorkflowsBulkPost({ body: payload });

export const exportWorkflowsZip = async (workflow_ids: number[]) => {
  const response = await bulkWorkflowOperationWorkflowsBulkPost({
    body: { action: "export", workflow_ids } as BulkWorkflowRequest,
    parseAs: "blob",
  });

  const blob = response.data as unknown as Blob;
  const disposition = response.response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename="([^"]+)"/i);
  const fileName = filenameMatch?.[1] || "workflows-export.zip";

  return { blob, fileName };
};

// --- Version API wrappers ---

export const listVersions = (workflow_id: number) =>
  listWorkflowVersionsWorkflowsWorkflowIdVersionsGet({ path: { workflow_id } });

export const createVersion = (
  workflow_id: number,
  payload: {
    base_version_id: number | null;
    workflow_data: Record<string, unknown>;
    message?: string | null;
  },
) =>
  createWorkflowVersionWorkflowsWorkflowIdVersionsPost({
    path: { workflow_id },
    body: payload as WorkflowCreateVersion,
  });

export const getVersion = (workflow_id: number, version_id: number) =>
  getWorkflowVersionWorkflowsWorkflowIdVersionsVersionIdGet({
    path: { workflow_id, version_id },
  });

export const publishVersion = (workflow_id: number, version_id: number) =>
  publishWorkflowVersionWorkflowsWorkflowIdPublishPost({
    path: { workflow_id },
    body: { version_id } as WorkflowPublishVersion,
  });

export const restoreVersion = (workflow_id: number, version_id: number, message?: string) =>
  restoreWorkflowVersionWorkflowsWorkflowIdRestoreVersionIdPost({
    path: { workflow_id, version_id },
    body: message ? ({ message } as WorkflowRestoreVersion) : null,
  });

/** Request access to view all executions for a workflow (publishes wildcard token to RTES) */
export const requestExecutionAccess = (workflow_id: number) =>
  getWorkflowExecutionsExecutionsWorkflowsWorkflowIdGet({ path: { workflow_id } });

/** Request access to view a specific execution (publishes scoped token to RTES) */
export const requestSpecificExecutionAccess = (workflow_id: number, execution_id: string) =>
  getExecutionExecutionsWorkflowsWorkflowIdExecutionIdGet({
    path: { workflow_id, execution_id },
  });

// --- Conflict error helper ---

/**
 * Check if a thrown error from createVersion is a 409 version conflict.
 *
 * With `throwOnError: true`, the @hey-api client throws the parsed JSON
 * response body directly: `{ success, message, data: { server_version, server_version_id } }`.
 */
export function isVersionConflict(
  error: unknown,
): { serverVersion: number; serverVersionId: number } | null {
  if (error != null && typeof error === "object" && "data" in error) {
    const conflict = (error as { data?: { server_version?: number; server_version_id?: number } })
      .data;
    if (
      conflict &&
      typeof conflict.server_version === "number" &&
      typeof conflict.server_version_id === "number"
    ) {
      return {
        serverVersion: conflict.server_version,
        serverVersionId: conflict.server_version_id,
      };
    }
  }
  return null;
}

// Useful response types
export type ListWorkflowsResponse = ListWorkflowsWorkflowsGetResponse;
export type ListUserExecutionsResponse = ListUserExecutionsExecutionsGetResponse;
export type GetWorkflowResponse = GetWorkflowWorkflowsWorkflowIdGetResponse;
export type CreateWorkflowResponse = CreateWorkflowWorkflowsPostResponse;
export type UpdateWorkflowNameResponse = UpdateNameWorkflowsWorkflowIdNamePutResponse;
export type UpdateWorkflowStatusResponse = UpdateStatusWorkflowsWorkflowIdStatusPutResponse;
export type DeleteWorkflowResponse = DeleteWorkflowWorkflowsWorkflowIdDeleteResponse;
export type RunWorkflowResponse = RunWorkflowWorkflowsWorkflowIdRunPostResponse;
export type BulkWorkflowOperationResponse = BulkWorkflowOperationWorkflowsBulkPostResponse;
export type RequestExecutionAccessResponse =
  GetWorkflowExecutionsExecutionsWorkflowsWorkflowIdGetResponse;
export type RequestSpecificExecutionAccessResponse =
  GetExecutionExecutionsWorkflowsWorkflowIdExecutionIdGetResponse;
export type ListVersionsResponse = ListWorkflowVersionsWorkflowsWorkflowIdVersionsGetResponse;
export type CreateVersionResponse = CreateWorkflowVersionWorkflowsWorkflowIdVersionsPostResponse;
export type GetVersionResponse = GetWorkflowVersionWorkflowsWorkflowIdVersionsVersionIdGetResponse;
export type PublishVersionResponse = PublishWorkflowVersionWorkflowsWorkflowIdPublishPostResponse;
export type RestoreVersionResponse =
  RestoreWorkflowVersionWorkflowsWorkflowIdRestoreVersionIdPostResponse;
