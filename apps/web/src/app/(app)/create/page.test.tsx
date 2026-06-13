import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/test/render";
import type { TemplateSummary } from "@/client/types.gen";

const listTemplatesMock = vi.hoisted(() => vi.fn());
const listWorkflowsMock = vi.hoisted(() => vi.fn());
const listUserExecutionsMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/templates", () => ({
  listTemplates: listTemplatesMock,
}));

vi.mock("@/lib/api/workflows", () => ({
  listWorkflows: listWorkflowsMock,
  listUserExecutions: listUserExecutionsMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import CreatePage from "./page";

function template(overrides: Partial<TemplateSummary> = {}): TemplateSummary {
  return {
    id: 1,
    name: "GitHub Status Digest",
    description: "Summarize repository activity.",
    category: "development",
    usage_count: 12,
    is_public: true,
    source: "official",
    scope: "official",
    tags: ["github"],
    node_count: 3,
    ...overrides,
  };
}

describe("CreatePage", () => {
  beforeEach(() => {
    listTemplatesMock.mockReset();
    listWorkflowsMock.mockReset();
    listUserExecutionsMock.mockReset();
    pushMock.mockReset();
    listWorkflowsMock.mockResolvedValue({
      data: { data: { items: [], total: 0 } },
      error: undefined,
    });
    listUserExecutionsMock.mockResolvedValue({ data: { data: [] }, error: undefined });
  });

  it("renders real templates from the API and drops the old mock copy", async () => {
    listTemplatesMock.mockResolvedValue({
      data: { data: [template(), template({ id: 2, name: "Daily Weather Briefing" })] },
      error: undefined,
    });

    render(<CreatePage />);

    expect(await screen.findByText("GitHub Status Digest")).toBeInTheDocument();
    expect(screen.getByText("Daily Weather Briefing")).toBeInTheDocument();

    expect(screen.queryByText("Email → Slack Alert")).not.toBeInTheDocument();
    expect(screen.queryByText("RSS → Discord")).not.toBeInTheDocument();

    expect(listTemplatesMock).toHaveBeenCalledWith({ sort: "featured" });
  });

  it("hides the popular templates section when none load", async () => {
    listTemplatesMock.mockResolvedValue({ data: { data: [] }, error: undefined });

    render(<CreatePage />);

    await waitFor(() => expect(listTemplatesMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Popular Templates")).not.toBeInTheDocument());

    expect(screen.getByText("Use a Template")).toBeInTheDocument();
  });

  it("shows recent workflows ordered by most recent run", async () => {
    listTemplatesMock.mockResolvedValue({ data: { data: [] }, error: undefined });
    listWorkflowsMock.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: 1,
              name: "Never Run WF",
              description: "",
              is_active: false,
              status: "draft",
              role: "owner",
              owner_name: "me",
            },
            {
              id: 2,
              name: "Recently Run WF",
              description: "",
              is_active: true,
              status: "active",
              role: "owner",
              owner_name: "me",
            },
          ],
          total: 2,
        },
      },
      error: undefined,
    });
    listUserExecutionsMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "e1",
            workflow_id: 2,
            workflow_name: "Recently Run WF",
            status: "completed",
            created_at: "2026-06-01T00:00:00Z",
          },
        ],
      },
      error: undefined,
    });

    render(<CreatePage />);

    expect(await screen.findByText("Recent Workflows")).toBeInTheDocument();
    const cards = screen.getAllByRole("button");
    const runIndex = cards.findIndex((c) => c.textContent?.includes("Recently Run WF"));
    const neverIndex = cards.findIndex((c) => c.textContent?.includes("Never Run WF"));
    expect(runIndex).toBeGreaterThanOrEqual(0);
    expect(runIndex).toBeLessThan(neverIndex);
  });

  it("ranks recent runs across all accessible workflows", async () => {
    listTemplatesMock.mockResolvedValue({ data: { data: [] }, error: undefined });
    const workflows = Array.from({ length: 13 }, (_, index) => ({
      id: index + 1,
      name: `Workflow ${index + 1}`,
      description: "",
      is_active: false,
      status: "draft",
      role: "owner",
      owner_name: "me",
    }));
    listWorkflowsMock.mockResolvedValue({
      data: { data: workflows },
      error: undefined,
    });
    listUserExecutionsMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "e1",
            workflow_id: 13,
            workflow_name: "Workflow 13",
            status: "completed",
            created_at: "2026-06-08T00:00:00Z",
          },
        ],
      },
      error: undefined,
    });

    render(<CreatePage />);

    expect(await screen.findByText("Workflow 13")).toBeInTheDocument();
    expect(listWorkflowsMock).toHaveBeenCalledWith();
  });

  it("shows the Smith starter box instead of recent workflows when the user has none", async () => {
    listTemplatesMock.mockResolvedValue({ data: { data: [] }, error: undefined });

    render(<CreatePage />);

    expect(await screen.findByRole("button", { name: /generate with smith/i })).toBeInTheDocument();
    expect(screen.queryByText("Recent Workflows")).not.toBeInTheDocument();
  });
});
