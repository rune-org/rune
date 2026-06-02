import { describe, expect, it } from "vitest";

import {
  canChangeWorkflowStatus,
  canDeleteTemplate,
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

describe("template permissions", () => {
  it("author can delete their own template", () => {
    expect(canDeleteTemplate("user", 7, 7, false)).toBe(true);
  });

  it("non-author non-admin cannot delete someone else's template", () => {
    expect(canDeleteTemplate("user", 7, 8, false)).toBe(false);
  });

  it("admin can delete any user-created template", () => {
    expect(canDeleteTemplate("user", 7, 8, true)).toBe(true);
    expect(canDeleteTemplate("user", null, 8, true)).toBe(true);
  });

  it("official templates can never be deleted, even by admins", () => {
    expect(canDeleteTemplate("official", null, 8, true)).toBe(false);
    expect(canDeleteTemplate("official", 7, 7, false)).toBe(false);
  });

  it("author-less templates are not deletable by regular users", () => {
    expect(canDeleteTemplate("user", null, 8, false)).toBe(false);
  });

  it("unknown current user cannot delete", () => {
    expect(canDeleteTemplate("user", 7, undefined, false)).toBe(false);
    expect(canDeleteTemplate("user", 7, null, false)).toBe(false);
  });
});
