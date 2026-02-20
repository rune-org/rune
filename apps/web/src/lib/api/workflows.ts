import {
  listWorkflowsWorkflowsGet,
  getWorkflowWorkflowsWorkflowIdGet,
  createWorkflowWorkflowsPost,
  updateNameWorkflowsWorkflowIdNamePut,
  updateStatusWorkflowsWorkflowIdStatusPut,
  deleteWorkflowWorkflowsWorkflowIdDelete,
  runWorkflowWorkflowsWorkflowIdRunPost,
  updateWorkflowDataWorkflowsWorkflowIdDataPut,
  getWorkflowExecutionsWorkflowsWorkflowIdExecutionsGet,
  getExecutionWorkflowsWorkflowIdExecutionsExecutionIdGet,
} from "@/client";

import type {
  WorkflowCreate,
  WorkflowUpdateName,
  WorkflowUpdateStatus,
  WorkflowUpdateData,
  ListWorkflowsWorkflowsGetResponse,
  GetWorkflowWorkflowsWorkflowIdGetResponse,
  CreateWorkflowWorkflowsPostResponse,
  UpdateNameWorkflowsWorkflowIdNamePutResponse,
  UpdateStatusWorkflowsWorkflowIdStatusPutResponse,
  DeleteWorkflowWorkflowsWorkflowIdDeleteResponse,
  RunWorkflowWorkflowsWorkflowIdRunPostResponse,
  UpdateWorkflowDataWorkflowsWorkflowIdDataPutResponse,
  GetWorkflowExecutionsWorkflowsWorkflowIdExecutionsGetResponse,
  GetExecutionWorkflowsWorkflowIdExecutionsExecutionIdGetResponse,
} from "@/client/types.gen";

// Readable wrappers for workflow-related SDK functions

export const listWorkflows = () => listWorkflowsWorkflowsGet();

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

export const runWorkflow = (workflow_id: number) =>
  runWorkflowWorkflowsWorkflowIdRunPost({ path: { workflow_id } });

export const updateWorkflowData = (
  workflow_id: number,
  workflow_data: Record<string, unknown>,
) =>
  updateWorkflowDataWorkflowsWorkflowIdDataPut({
    path: { workflow_id },
    body: { workflow_data } as WorkflowUpdateData,
  });

/** Request access to view all executions for a workflow (publishes wildcard token to RTES) */
export const requestExecutionAccess = (workflow_id: number) =>
  getWorkflowExecutionsWorkflowsWorkflowIdExecutionsGet({ path: { workflow_id } });

/** Request access to view a specific execution (publishes scoped token to RTES) */
export const requestSpecificExecutionAccess = (workflow_id: number, execution_id: string) =>
  getExecutionWorkflowsWorkflowIdExecutionsExecutionIdGet({
    path: { workflow_id, execution_id },
  });

// Useful response types
export type ListWorkflowsResponse = ListWorkflowsWorkflowsGetResponse;
export type GetWorkflowResponse = GetWorkflowWorkflowsWorkflowIdGetResponse;
export type CreateWorkflowResponse = CreateWorkflowWorkflowsPostResponse;
export type UpdateWorkflowNameResponse =
  UpdateNameWorkflowsWorkflowIdNamePutResponse;
export type UpdateWorkflowStatusResponse =
  UpdateStatusWorkflowsWorkflowIdStatusPutResponse;
export type DeleteWorkflowResponse =
  DeleteWorkflowWorkflowsWorkflowIdDeleteResponse;
export type RunWorkflowResponse = RunWorkflowWorkflowsWorkflowIdRunPostResponse;
export type UpdateWorkflowDataResponse =
  UpdateWorkflowDataWorkflowsWorkflowIdDataPutResponse;
export type RequestExecutionAccessResponse =
  GetWorkflowExecutionsWorkflowsWorkflowIdExecutionsGetResponse;
export type RequestSpecificExecutionAccessResponse =
  GetExecutionWorkflowsWorkflowIdExecutionsExecutionIdGetResponse;
