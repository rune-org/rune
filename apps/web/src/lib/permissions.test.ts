import { describe, expect, it } from "vitest";

import {
  canChangeWorkflowStatus,
  canDeleteWorkflow,
  canEditWorkflow,
  canExecuteWorkflow,
  canRenameWorkflow,
  canShareWorkflow,
  canViewWorkflow,
  type WorkflowRole,
} from "./permissions";

describe("workflow permissions", () => {
  it("test_viewer_can_view_but_cannot_change_or_run_workflow", () => {
    const role: WorkflowRole = "viewer";

    expect(canViewWorkflow(role)).toBe(true);
    expect(canEditWorkflow(role)).toBe(false);
    expect(canExecuteWorkflow(role)).toBe(false);
    expect(canDeleteWorkflow(role)).toBe(false);
    expect(canShareWorkflow(role)).toBe(false);
    expect(canRenameWorkflow(role)).toBe(false);
    expect(canChangeWorkflowStatus(role)).toBe(false);
  });

  it("test_editor_can_edit_and_run_but_cannot_delete_or_share", () => {
    const role: WorkflowRole = "editor";

    expect(canViewWorkflow(role)).toBe(true);
    expect(canEditWorkflow(role)).toBe(true);
    expect(canExecuteWorkflow(role)).toBe(true);
    expect(canDeleteWorkflow(role)).toBe(false);
    expect(canShareWorkflow(role)).toBe(false);
    expect(canRenameWorkflow(role)).toBe(true);
    expect(canChangeWorkflowStatus(role)).toBe(true);
  });

  it("test_owner_has_full_workflow_management_permissions", () => {
    const role: WorkflowRole = "owner";

    expect(canViewWorkflow(role)).toBe(true);
    expect(canEditWorkflow(role)).toBe(true);
    expect(canExecuteWorkflow(role)).toBe(true);
    expect(canDeleteWorkflow(role)).toBe(true);
    expect(canShareWorkflow(role)).toBe(true);
    expect(canRenameWorkflow(role)).toBe(true);
    expect(canChangeWorkflowStatus(role)).toBe(true);
  });

  it("test_admin_override_grants_permissions_even_with_viewer_workflow_role", () => {
    expect(canViewWorkflow("viewer", true)).toBe(true);
    expect(canEditWorkflow("viewer", true)).toBe(true);
    expect(canExecuteWorkflow("viewer", true)).toBe(true);
    expect(canDeleteWorkflow("viewer", true)).toBe(true);
    expect(canShareWorkflow("viewer", true)).toBe(true);
    expect(canRenameWorkflow("viewer", true)).toBe(true);
    expect(canChangeWorkflowStatus("viewer", true)).toBe(true);
  });
});
