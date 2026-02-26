/**
 * API functions for workflow permissions management.
 * 
 * These functions use the generated hey-api client to call the backend
 * permissions endpoints defined in services/api/src/permissions/router.py
 */

import {
  shareWorkflowWorkflowsWorkflowIdSharePost,
  revokeAccessWorkflowsWorkflowIdShareUserIdDelete,
  listWorkflowPermissionsWorkflowsWorkflowIdPermissionsGet,
  updateUserRoleWorkflowsWorkflowIdPermissionsUserIdPatch,
} from "@/client/sdk.gen";
import type { WorkflowRole } from "@/lib/permissions";

/**
 * Information about a user's permission to access a workflow.
 */
export interface WorkflowPermission {
  user_id: number;
  user_name: string;
  user_email: string;
  role: WorkflowRole;
}

/**
 * Share a workflow with another user.
 * 
 * Backend endpoint: POST /workflows/{workflow_id}/share
 * 
 * Only OWNER can share. Cannot grant "owner" role through this endpoint.
 * 
 * @param workflowId - The workflow ID
 * @param userId - The target user ID to share with
 * @param role - The role to grant ("editor" or "viewer", not "owner")
 */
export async function shareWorkflow(
  workflowId: string,
  userId: number,
  role: WorkflowRole
): Promise<void> {
  if (role === "owner") {
    throw new Error("Cannot grant owner role through sharing");
  }

  const { error } = await shareWorkflowWorkflowsWorkflowIdSharePost({
    path: { workflow_id: parseInt(workflowId) },
    body: {
      user_id: userId,
      role: role,
    },
  });

  if (error) {
    const message = typeof error.detail === 'string' ? error.detail : "Failed to share workflow";
    throw new Error(message);
  }
}

/**
 * Revoke a user's access to a workflow.
 * 
 * Backend endpoint: DELETE /workflows/{workflow_id}/share/{user_id}
 * 
 * Only OWNER can revoke access.
 * 
 * @param workflowId - The workflow ID
 * @param userId - The user ID to revoke access from
 */
export async function revokeWorkflowAccess(
  workflowId: string,
  userId: number
): Promise<void> {
  const { error } = await revokeAccessWorkflowsWorkflowIdShareUserIdDelete({
    path: {
      workflow_id: parseInt(workflowId),
      user_id: userId,
    },
  });

  if (error) {
    const message = typeof error.detail === 'string' ? error.detail : "Failed to revoke access";
    throw new Error(message);
  }
}

/**
 * List all users who have access to a workflow.
 * 
 * Backend endpoint: GET /workflows/{workflow_id}/permissions
 * 
 * Any user with access (owner, editor, viewer) can list permissions.
 * 
 * @param workflowId - The workflow ID
 * @returns Array of users with their roles
 */
export async function listWorkflowPermissions(
  workflowId: string
): Promise<WorkflowPermission[]> {
  const { data, error } = await listWorkflowPermissionsWorkflowsWorkflowIdPermissionsGet({
    path: { workflow_id: parseInt(workflowId) },
  });

  if (error) {
    const message = typeof error.detail === 'string' ? error.detail : "Failed to fetch permissions";
    throw new Error(message);
  }

  return data?.data?.permissions || [];
}

/**
 * Update a user's role for a workflow.
 * 
 * Backend endpoint: PATCH /workflows/{workflow_id}/permissions/{user_id}
 * 
 * Only OWNER can update roles. Cannot grant or transfer "owner" role.
 * 
 * @param workflowId - The workflow ID
 * @param userId - The user ID whose role to update
 * @param role - The new role ("editor" or "viewer", not "owner")
 */
export async function updateWorkflowUserRole(
  workflowId: string,
  userId: number,
  role: WorkflowRole
): Promise<void> {
  if (role === "owner") {
    throw new Error("Cannot grant owner role through role update");
  }

  const { error } = await updateUserRoleWorkflowsWorkflowIdPermissionsUserIdPatch({
    path: {
      workflow_id: parseInt(workflowId),
      user_id: userId,
    },
    body: {
      role: role,
    },
  });

  if (error) {
    const message = typeof error.detail === 'string' ? error.detail : "Failed to update role";
    throw new Error(message);
  }
}
