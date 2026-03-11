import {
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

// --- Version API wrappers ---

export const listVersions = (workflow_id: number) =>
  listWorkflowVersionsWorkflowsWorkflowIdVersionsGet({ path: { workflow_id } });

export const createVersion = (
  workflow_id: number,
  payload: { base_version_id: number | null; workflow_data: Record<string, unknown>; message?: string | null },
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
 * Check if an error from createVersion is a 409 version conflict.
 *
 * The @hey-api client returns `{ data: undefined, error: ApiResponseWorkflowVersionConflict, response }`.
 * The `error` object is the parsed JSON body: `{ success, message, data: { server_version, server_version_id } }`.
 * The HTTP status lives on `response.status`, not on the error object itself.
 */
export function isVersionConflict(
  error: unknown,
  response?: Response,
): { serverVersion: number; serverVersionId: number } | null {
  // If a Response is provided, verify it's actually a 409
  if (response && response.status !== 409) return null;

  if (error != null && typeof error === "object" && "data" in error) {
    const conflict = (error as { data?: { server_version?: number; server_version_id?: number } }).data;
    if (conflict && typeof conflict.server_version === "number" && typeof conflict.server_version_id === "number") {
      return { serverVersion: conflict.server_version, serverVersionId: conflict.server_version_id };
    }
  }
  return null;
}

// Useful response types
export type ListWorkflowsResponse = ListWorkflowsWorkflowsGetResponse;
export type ListUserExecutionsResponse = ListUserExecutionsExecutionsGetResponse;
export type GetWorkflowResponse = GetWorkflowWorkflowsWorkflowIdGetResponse;
export type CreateWorkflowResponse = CreateWorkflowWorkflowsPostResponse;
export type UpdateWorkflowNameResponse =
  UpdateNameWorkflowsWorkflowIdNamePutResponse;
export type UpdateWorkflowStatusResponse =
  UpdateStatusWorkflowsWorkflowIdStatusPutResponse;
export type DeleteWorkflowResponse =
  DeleteWorkflowWorkflowsWorkflowIdDeleteResponse;
export type RunWorkflowResponse = RunWorkflowWorkflowsWorkflowIdRunPostResponse;
export type RequestExecutionAccessResponse =
  GetWorkflowExecutionsExecutionsWorkflowsWorkflowIdGetResponse;
export type RequestSpecificExecutionAccessResponse =
  GetExecutionExecutionsWorkflowsWorkflowIdExecutionIdGetResponse;
export type ListVersionsResponse = ListWorkflowVersionsWorkflowsWorkflowIdVersionsGetResponse;
export type CreateVersionResponse = CreateWorkflowVersionWorkflowsWorkflowIdVersionsPostResponse;
export type GetVersionResponse = GetWorkflowVersionWorkflowsWorkflowIdVersionsVersionIdGetResponse;
export type PublishVersionResponse = PublishWorkflowVersionWorkflowsWorkflowIdPublishPostResponse;
export type RestoreVersionResponse = RestoreWorkflowVersionWorkflowsWorkflowIdRestoreVersionIdPostResponse;
