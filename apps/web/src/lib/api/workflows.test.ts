import { beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({
  bulkWorkflowOperationWorkflowsBulkPost: vi.fn(),
  listWorkflowsWorkflowsGet: vi.fn(),
  getWorkflowWorkflowsWorkflowIdGet: vi.fn(),
  createWorkflowWorkflowsPost: vi.fn(),
  updateNameWorkflowsWorkflowIdNamePut: vi.fn(),
  updateStatusWorkflowsWorkflowIdStatusPut: vi.fn(),
  deleteWorkflowWorkflowsWorkflowIdDelete: vi.fn(),
  runWorkflowWorkflowsWorkflowIdRunPost: vi.fn(),
  listUserExecutionsExecutionsGet: vi.fn(),
  getWorkflowExecutionsExecutionsWorkflowsWorkflowIdGet: vi.fn(),
  getExecutionExecutionsWorkflowsWorkflowIdExecutionIdGet: vi.fn(),
  listWorkflowVersionsWorkflowsWorkflowIdVersionsGet: vi.fn(),
  createWorkflowVersionWorkflowsWorkflowIdVersionsPost: vi.fn(),
  getWorkflowVersionWorkflowsWorkflowIdVersionsVersionIdGet: vi.fn(),
  publishWorkflowVersionWorkflowsWorkflowIdPublishPost: vi.fn(),
  restoreWorkflowVersionWorkflowsWorkflowIdRestoreVersionIdPost: vi.fn(),
}));

vi.mock("@/client", () => clientMocks);

import {
  exportSingleWorkflowJson,
  exportWorkflowsZip,
  isVersionConflict,
  runWorkflow,
} from "./workflows";

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("workflow api helpers", () => {
  beforeEach(() => {
    Object.values(clientMocks).forEach((mock) => mock.mockReset());
  });

  it("passes version ids to runWorkflow only when provided", async () => {
    clientMocks.runWorkflowWorkflowsWorkflowIdRunPost.mockResolvedValue({});

    await runWorkflow(7);
    await runWorkflow(7, 9);

    expect(clientMocks.runWorkflowWorkflowsWorkflowIdRunPost).toHaveBeenNthCalledWith(1, {
      path: { workflow_id: 7 },
      body: null,
    });
    expect(clientMocks.runWorkflowWorkflowsWorkflowIdRunPost).toHaveBeenNthCalledWith(2, {
      path: { workflow_id: 7 },
      body: { version_id: 9 },
    });
  });

  it("creates zip exports via the generated bulk endpoint", async () => {
    const blob = new Blob(["zip"]);
    clientMocks.bulkWorkflowOperationWorkflowsBulkPost.mockResolvedValue({ data: blob });

    const result = await exportWorkflowsZip([1, 2]);

    expect(clientMocks.bulkWorkflowOperationWorkflowsBulkPost).toHaveBeenCalledWith({
      body: { action: "export", workflow_ids: [1, 2] },
      parseAs: "blob",
    });
    expect(result).toEqual({ blob, fileName: "workflows-export.zip" });
  });

  it("sanitizes credentials from single workflow JSON exports", async () => {
    clientMocks.getWorkflowWorkflowsWorkflowIdGet.mockResolvedValue({
      data: {
        data: {
          name: "welcome",
          latest_version: {
            workflow_data: {
              nodes: [
                {
                  id: "node-1",
                  credentials: { id: "cred-1" },
                  data: { credential: { id: "cred-1" }, label: "Node 1" },
                },
              ],
              edges: [],
            },
          },
        },
      },
    });

    const { blob, fileName } = await exportSingleWorkflowJson(42);
    const payload = JSON.parse(await readBlobAsText(blob));

    expect(fileName).toBe("workflow-welcome-42.json");
    expect(payload).toEqual({
      nodes: [{ id: "node-1", data: { label: "Node 1" } }],
      edges: [],
    });
  });

  it("rejects single workflow exports when no workflow data exists", async () => {
    clientMocks.getWorkflowWorkflowsWorkflowIdGet.mockResolvedValue({
      data: { data: { name: "broken", latest_version: null } },
    });

    await expect(exportSingleWorkflowJson(42)).rejects.toThrow(
      "No workflow data available for export",
    );
  });

  it("detects version conflicts from API error payloads", () => {
    expect(isVersionConflict({ data: { server_version: 4, server_version_id: 11 } })).toEqual({
      serverVersion: 4,
      serverVersionId: 11,
    });
    expect(isVersionConflict({ data: { server_version: 4 } })).toBeNull();
    expect(isVersionConflict(null)).toBeNull();
  });
});
