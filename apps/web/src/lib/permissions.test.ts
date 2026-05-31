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
  function visibleWorkflowActions(role: WorkflowRole, isAdmin = false): string[] {
    const actions = [
      ["open-canvas", canViewWorkflow(role, isAdmin)],
      ["export-json", canViewWorkflow(role, isAdmin)],
      ["run", canExecuteWorkflow(role, isAdmin)],
      ["rename", canRenameWorkflow(role, isAdmin)],
      ["toggle-active", canChangeWorkflowStatus(role, isAdmin)],
      ["share", canShareWorkflow(role, isAdmin)],
      ["delete", canDeleteWorkflow(role, isAdmin)],
    ] as const;

    return actions.filter(([, allowed]) => allowed).map(([action]) => action);
  }

  it("viewer can only access read-only workflow actions", () => {
    expect(visibleWorkflowActions("viewer")).toEqual(["open-canvas", "export-json"]);
    expect(canEditWorkflow("viewer")).toBe(false);
  });

  it("editor can run and modify workflow but not share or delete", () => {
    expect(visibleWorkflowActions("editor")).toEqual([
      "open-canvas",
      "export-json",
      "run",
      "rename",
      "toggle-active",
    ]);
    expect(canEditWorkflow("editor")).toBe(true);
  });

  it("owner can access every workflow action", () => {
    expect(visibleWorkflowActions("owner")).toEqual([
      "open-canvas",
      "export-json",
      "run",
      "rename",
      "toggle-active",
      "share",
      "delete",
    ]);
    expect(canEditWorkflow("owner")).toBe(true);
  });

  it("admin override grants all workflow actions even for viewer role", () => {
    expect(visibleWorkflowActions("viewer", true)).toEqual([
      "open-canvas",
      "export-json",
      "run",
      "rename",
      "toggle-active",
      "share",
      "delete",
    ]);
    expect(canEditWorkflow("viewer", true)).toBe(true);
  });
});
