/**
 * Permission checking utilities for workflow role-based access control.
 * 
 * These functions match the backend WorkflowPolicy permissions defined in:
 * services/api/src/workflow/policy.py
 * 
 * Permission Matrix:
 * - OWNER: view, edit, execute, delete, share
 * - EDITOR: view, edit, execute
 * - VIEWER: view only
 * - ADMIN: all permissions (bypassed in backend)
 */

export type WorkflowRole = "owner" | "editor" | "viewer";

/**
 * Check if user can view/read the workflow.
 * All roles can view.
 */
export function canViewWorkflow(role: WorkflowRole): boolean {
  return ["owner", "editor", "viewer"].includes(role);
}

/**
 * Check if user can edit the workflow.
 * Only OWNER and EDITOR can modify.
 */
export function canEditWorkflow(role: WorkflowRole): boolean {
  return ["owner", "editor"].includes(role);
}

/**
 * Check if user can execute/run the workflow.
 * VIEWER cannot execute (read-only).
 */
export function canExecuteWorkflow(role: WorkflowRole): boolean {
  return ["owner", "editor"].includes(role);
}

/**
 * Check if user can delete the workflow.
 * Only OWNER can delete.
 */
export function canDeleteWorkflow(role: WorkflowRole): boolean {
  return role === "owner";
}

/**
 * Check if user can share the workflow with others.
 * Only OWNER can share/invite others.
 */
export function canShareWorkflow(role: WorkflowRole): boolean {
  return role === "owner";
}

/**
 * Check if user can rename the workflow.
 * OWNER and EDITOR can rename.
 */
export function canRenameWorkflow(role: WorkflowRole): boolean {
  return ["owner", "editor"].includes(role);
}

/**
 * Check if user can change workflow status (activate/deactivate).
 * OWNER and EDITOR can change status.
 */
export function canChangeWorkflowStatus(role: WorkflowRole): boolean {
  return ["owner", "editor"].includes(role);
}
