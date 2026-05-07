import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen } from "@/test/render";
import type { WorkflowSummary } from "@/lib/workflows";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkflowRowActions } from "./WorkflowRowActions";

function makeWorkflow(role: WorkflowSummary["role"]): WorkflowSummary {
  return {
    id: "wf-1",
    name: "Nightly sync",
    description: "Sync customer data",
    status: "active",
    triggerType: "Manual",
    lastRunAt: null,
    lastRunStatus: "n/a",
    runs: 0,
    role,
    ownerName: "Me",
  };
}

function renderActions(
  role: WorkflowSummary["role"],
  options?: {
    isAdmin?: boolean;
    isPending?: boolean;
    isExporting?: boolean;
    status?: WorkflowSummary["status"];
  },
) {
  const workflow = makeWorkflow(role);
  workflow.status = options?.status ?? workflow.status;
  const callbacks = {
    onRun: vi.fn(),
    onExport: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onToggleActive: vi.fn(),
    onShare: vi.fn(),
  };

  render(
    <TooltipProvider>
      <WorkflowRowActions
        workflow={workflow}
        isAdmin={options?.isAdmin ?? false}
        isPending={options?.isPending ?? false}
        isExporting={options?.isExporting ?? false}
        {...callbacks}
      />
    </TooltipProvider>,
  );

  return { workflow, ...callbacks };
}

describe("WorkflowRowActions", () => {
  it("viewer only sees read-only actions in workflow list row", async () => {
    const user = userEvent.setup();
    const { workflow } = renderActions("viewer");

    expect(screen.queryByLabelText(`Run ${workflow.name}`)).not.toBeInTheDocument();
    expect(screen.getByLabelText(`Export ${workflow.name} to JSON`)).toBeInTheDocument();
    expect(screen.queryByLabelText(`Delete ${workflow.name}`)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(`More actions for ${workflow.name}`));

    expect(screen.getByRole("menuitem", { name: "Open in Canvas" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Export to JSON" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Run" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("editor can run and edit status but cannot share or delete", async () => {
    const user = userEvent.setup();
    const { workflow } = renderActions("editor");

    expect(screen.getByLabelText(`Run ${workflow.name}`)).toBeInTheDocument();
    expect(screen.getByLabelText(`Export ${workflow.name} to JSON`)).toBeInTheDocument();
    expect(screen.queryByLabelText(`Delete ${workflow.name}`)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(`More actions for ${workflow.name}`));

    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Run" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("owner actions trigger callbacks that a user depends on", async () => {
    const user = userEvent.setup();
    const { workflow, onRun, onExport, onDelete, onShare } = renderActions("owner");

    await user.click(screen.getByLabelText(`Run ${workflow.name}`));
    await user.click(screen.getByLabelText(`Export ${workflow.name} to JSON`));
    await user.click(screen.getByLabelText(`Delete ${workflow.name}`));

    expect(onRun).toHaveBeenCalledWith(workflow);
    expect(onExport).toHaveBeenCalledWith(workflow);
    expect(onDelete).toHaveBeenCalledWith(workflow);

    await user.click(screen.getByLabelText(`More actions for ${workflow.name}`));
    await user.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(onShare).toHaveBeenCalledWith(workflow);
  });

  it("admin override exposes full workflow actions even when role is viewer", async () => {
    const user = userEvent.setup();
    const { workflow } = renderActions("viewer", { isAdmin: true });

    expect(screen.getByLabelText(`Run ${workflow.name}`)).toBeInTheDocument();
    expect(screen.getByLabelText(`Delete ${workflow.name}`)).toBeInTheDocument();

    await user.click(screen.getByLabelText(`More actions for ${workflow.name}`));
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows Activate for inactive workflows and keeps actions disabled while pending", async () => {
    const user = userEvent.setup();
    const { workflow, onRun, onDelete } = renderActions("owner", {
      status: "draft",
      isPending: true,
    });

    expect(screen.getByLabelText(`Run ${workflow.name}`)).toBeDisabled();
    expect(screen.getByLabelText(`Delete ${workflow.name}`)).toBeDisabled();

    await user.click(screen.getByLabelText(`More actions for ${workflow.name}`));
    expect(screen.getByRole("menuitem", { name: "Activate" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveAttribute("data-disabled");

    expect(onRun).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
