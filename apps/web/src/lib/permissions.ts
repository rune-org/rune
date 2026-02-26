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
 * - ADMIN (system role): all permissions (bypasses workflow role checks)
 */

export type WorkflowRole = "owner" | "editor" | "viewer";
export type SystemRole = "user" | "admin";

/**
 * Check if user can view/read the workflow.
 * All roles can view. Admins always have access.
 */
export function canViewWorkflow(role: WorkflowRole, isAdmin: boolean = false): boolean {
  return isAdmin || ["owner", "editor", "viewer"].includes(role);
}

/**
 * Check if user can edit the workflow.
 * Only OWNER and EDITOR can modify. Admins always have access.
 */
export function canEditWorkflow(role: WorkflowRole, isAdmin: boolean = false): boolean {
  return isAdmin || ["owner", "editor"].includes(role);
}

/**
 * Check if user can execute/run the workflow.
 * VIEWER cannot execute (read-only). Admins always have access.
 */
export function canExecuteWorkflow(role: WorkflowRole, isAdmin: boolean = false): boolean {
  return isAdmin || ["owner", "editor"].includes(role);
}

/**
 * Check if user can delete the workflow.
 * Only OWNER can delete. Admins always have access.
 */
export function canDeleteWorkflow(role: WorkflowRole, isAdmin: boolean = false): boolean {
  return isAdmin || role === "owner";
}

/**
 * Check if user can share the workflow with others.
 * Only OWNER can share/invite others. Admins always have access.
 */
export function canShareWorkflow(role: WorkflowRole, isAdmin: boolean = false): boolean {
  return isAdmin || role === "owner";
}

/**
 * Check if user can rename the workflow.
 * OWNER and EDITOR can rename. Admins always have access.
 */
export function canRenameWorkflow(role: WorkflowRole, isAdmin: boolean = false): boolean {
  return isAdmin || ["owner", "editor"].includes(role);
}

/**
 * Check if user can change workflow status (activate/deactivate).
 * OWNER and EDITOR can change status. Admins always have access.
 */
export function canChangeWorkflowStatus(role: WorkflowRole, isAdmin: boolean = false): boolean {
  return isAdmin || ["owner", "editor"].includes(role);
}
