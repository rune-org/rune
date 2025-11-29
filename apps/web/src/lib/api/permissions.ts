import {
  shareWorkflowWorkflowsWorkflowIdSharePost,
  revokeAccessWorkflowsWorkflowIdShareUserIdDelete,
  listWorkflowPermissionsWorkflowsWorkflowIdPermissionsGet,
  updateUserRoleWorkflowsWorkflowIdPermissionsUserIdPatch,
} from "@/client";

import type { WorkflowRole } from "@/lib/workflows";

/**
 * Workflow permissions API functions
 * 
 * These functions use the generated hey-api client to interact with
 * the backend permissions endpoints for managing workflow sharing
 * and access control.
 */

/**
 * Share a workflow with another user
 * Only OWNER can share workflows
 * 
 * Backend endpoint: POST /workflows/{workflow_id}/share
 */
export const shareWorkflow = async (
  workflowId: number,
  userId: number,
  role: WorkflowRole
) => {
  // Validate role - cannot grant OWNER through sharing
  if (role === "owner") {
    throw new Error("Cannot grant OWNER role through sharing");
  }

  return shareWorkflowWorkflowsWorkflowIdSharePost({
    path: { workflow_id: workflowId },
    body: {
      user_id: userId,
      role: role as "editor" | "viewer",
    },
  });
};

/**
 * Revoke a user's access to a workflow
 * Only OWNER can revoke access
 * 
 * Backend endpoint: DELETE /workflows/{workflow_id}/share/{user_id}
 */
export const revokeWorkflowAccess = async (
  workflowId: number,
  userId: number
) => {
  return revokeAccessWorkflowsWorkflowIdShareUserIdDelete({
    path: { 
      workflow_id: workflowId,
      user_id: userId,
    },
  });
};

/**
 * List all users who have access to a workflow
 * Any role (OWNER, EDITOR, VIEWER) can view permissions
 * 
 * Backend endpoint: GET /workflows/{workflow_id}/permissions
 */
export const listWorkflowPermissions = async (workflowId: number) => {
  return listWorkflowPermissionsWorkflowsWorkflowIdPermissionsGet({
    path: { workflow_id: workflowId },
  });
};

/**
 * Update a user's role for a workflow
 * Only OWNER can update roles
 * 
 * Backend endpoint: PATCH /workflows/{workflow_id}/permissions/{user_id}
 */
export const updateWorkflowUserRole = async (
  workflowId: number,
  userId: number,
  role: WorkflowRole
) => {
  // Validate role - cannot grant OWNER through this endpoint
  if (role === "owner") {
    throw new Error("Cannot grant OWNER role through this endpoint");
  }

  return updateUserRoleWorkflowsWorkflowIdPermissionsUserIdPatch({
    path: { 
      workflow_id: workflowId,
      user_id: userId,
    },
    body: {
      role: role as "editor" | "viewer",
    },
  });
};