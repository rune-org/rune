import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen } from "@/test/render";
import type { WorkflowSummary } from "@/lib/workflows";
import { WorkflowsDialogs } from "./WorkflowDialogs";

function makeWorkflow(name: string): WorkflowSummary {
  return {
    id: "wf-1",
    name,
    description: null,
    status: "active",
    triggerType: "Manual",
    lastRunAt: null,
    lastRunStatus: "n/a",
    runs: 0,
    role: "owner",
    ownerName: "Me",
  };
}

describe("WorkflowsDialogs", () => {
  it("keeps save disabled for blank rename form values and submits valid names", async () => {
    const user = userEvent.setup();
    const onRenameSubmit = vi.fn();

    render(
      <WorkflowsDialogs
        renameTarget={makeWorkflow("Nightly sync")}
        descriptionTarget={null}
        deleteTarget={null}
        bulkDeleteOpen={false}
        pending={false}
        selectedCount={0}
        deletableCount={0}
        onRenameClose={vi.fn()}
        onRenameSubmit={onRenameSubmit}
        onDescriptionClose={vi.fn()}
        onDescriptionSubmit={vi.fn()}
        onDeleteCancel={vi.fn()}
        onDeleteConfirm={vi.fn()}
        onBulkDeleteCancel={vi.fn()}
        onBulkDeleteConfirm={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Name");
    const save = screen.getByRole("button", { name: "Save" });
    await user.clear(input);
    await user.type(input, "   ");
    expect(save).toBeDisabled();

    await user.clear(input);
    await user.type(input, "New name");
    await user.click(save);

    expect(onRenameSubmit).toHaveBeenCalledWith("New name");
  });

  it("shows skipped non-deletable workflows in bulk delete warning", () => {
    render(
      <WorkflowsDialogs
        renameTarget={null}
        descriptionTarget={null}
        deleteTarget={null}
        bulkDeleteOpen={true}
        pending={false}
        selectedCount={5}
        deletableCount={3}
        onRenameClose={vi.fn()}
        onRenameSubmit={vi.fn()}
        onDescriptionClose={vi.fn()}
        onDescriptionSubmit={vi.fn()}
        onDeleteCancel={vi.fn()}
        onDeleteConfirm={vi.fn()}
        onBulkDeleteCancel={vi.fn()}
        onBulkDeleteConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Delete selected workflows")).toBeInTheDocument();
    expect(
      screen.getByText(
        /2 selected workflows are skipped because you do not have delete permission/i,
      ),
    ).toBeInTheDocument();
  });
});
