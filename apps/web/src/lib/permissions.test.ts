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
  it.each<[WorkflowRole, boolean, boolean, boolean, boolean, boolean, boolean]>([
    ["owner", true, true, true, true, true, true],
    ["editor", true, true, true, false, false, true],
    ["viewer", true, false, false, false, false, false],
  ])(
    "applies the expected permissions for %s",
    (role, view, edit, execute, del, share, renameAndStatus) => {
      expect(canViewWorkflow(role)).toBe(view);
      expect(canEditWorkflow(role)).toBe(edit);
      expect(canExecuteWorkflow(role)).toBe(execute);
      expect(canDeleteWorkflow(role)).toBe(del);
      expect(canShareWorkflow(role)).toBe(share);
      expect(canRenameWorkflow(role)).toBe(renameAndStatus);
      expect(canChangeWorkflowStatus(role)).toBe(renameAndStatus);
    },
  );

  it("grants every permission to admins regardless of workflow role", () => {
    expect(canViewWorkflow("viewer", true)).toBe(true);
    expect(canEditWorkflow("viewer", true)).toBe(true);
    expect(canExecuteWorkflow("viewer", true)).toBe(true);
    expect(canDeleteWorkflow("viewer", true)).toBe(true);
    expect(canShareWorkflow("viewer", true)).toBe(true);
    expect(canRenameWorkflow("viewer", true)).toBe(true);
    expect(canChangeWorkflowStatus("viewer", true)).toBe(true);
  });
});
