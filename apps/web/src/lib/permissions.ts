import type { WorkflowRole } from "@/lib/workflows";

/**
 * Workflow permission utilities
 * 
 * Mirrors the backend WorkflowPolicy to ensure consistent permission checks
 * on the frontend for UI state (hiding/disabling actions).
 * 
 * Permissions:
 * - OWNER: can view, edit, execute, delete, and share workflows
 * - EDITOR: can view, edit, and execute workflows (cannot share or delete)
 * - VIEWER: can only view workflows (read-only access)
 */

/**
 * Check if user can view the workflow
 * All roles (owner, editor, viewer) can view
 */
export function canViewWorkflow(role: WorkflowRole): boolean {
  return ["owner", "editor", "viewer"].includes(role);
}

/**
 * Check if user can edit the workflow
 * Only owner and editor can edit
 */
export function canEditWorkflow(role: WorkflowRole): boolean {
  return ["owner", "editor"].includes(role);
}

/**
 * Check if user can execute/run the workflow
 * Only owner and editor can execute (viewer is read-only)
 */
export function canExecuteWorkflow(role: WorkflowRole): boolean {
  return ["owner", "editor"].includes(role);
}

/**
 * Check if user can delete the workflow
 * Only owner can delete
 */
export function canDeleteWorkflow(role: WorkflowRole): boolean {
  return role === "owner";
}

/**
 * Check if user can share the workflow with other users
 * Only owner can share
 */
export function canShareWorkflow(role: WorkflowRole): boolean {
  return role === "owner";
}

/**
 * Check if user can rename the workflow
 * Only owner and editor can rename
 */
export function canRenameWorkflow(role: WorkflowRole): boolean {
  return ["owner", "editor"].includes(role);
}

/**
 * Check if user can change workflow status (activate/deactivate)
 * Only owner and editor can change status
 */
export function canChangeWorkflowStatus(role: WorkflowRole): boolean {
  return ["owner", "editor"].includes(role);
}