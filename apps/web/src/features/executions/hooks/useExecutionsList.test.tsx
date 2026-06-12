import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExecutionsList } from "./useExecutionsList";

const { listUserExecutionsMock } = vi.hoisted(() => ({
  listUserExecutionsMock: vi.fn(),
}));

vi.mock("@/lib/api/workflows", () => ({
  listUserExecutions: listUserExecutionsMock,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function executionResponse(id: string, workflowName: string) {
  return {
    data: {
      data: {
        items: [
          {
            id,
            workflow_id: 1,
            workflow_name: workflowName,
            status: "completed",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        total: 1,
        total_pages: 1,
      },
    },
  };
}

describe("useExecutionsList", () => {
  beforeEach(() => {
    listUserExecutionsMock.mockReset();
  });

  it("ignores a stale search response that resolves after the latest request", async () => {
    const olderResponse = deferred<ReturnType<typeof executionResponse>>();
    const latestResponse = deferred<ReturnType<typeof executionResponse>>();

    listUserExecutionsMock.mockImplementation((params?: { search?: string }) => {
      if (!params) {
        return Promise.resolve({ data: { data: [] } });
      }
      if (params.search === "older") {
        return olderResponse.promise;
      }
      if (params.search === "latest") {
        return latestResponse.promise;
      }
      return Promise.resolve({ data: { data: { items: [], total: 0, total_pages: 1 } } });
    });

    function Harness() {
      const result = useExecutionsList();
      return (
        <>
          <button onClick={() => result.setSearch("older")}>Older search</button>
          <button onClick={() => result.setSearch("latest")}>Latest search</button>
          <div>{result.executions[0]?.workflowName ?? "empty"}</div>
        </>
      );
    }

    render(<Harness />);
    await waitFor(() => expect(screen.getByText("empty")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Older search" }));
    await waitFor(() =>
      expect(listUserExecutionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: "older" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Latest search" }));
    await waitFor(() =>
      expect(listUserExecutionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ search: "latest" }),
      ),
    );

    await act(async () => {
      latestResponse.resolve(executionResponse("latest-id", "Latest workflow"));
      await latestResponse.promise;
    });
    expect(screen.getByText("Latest workflow")).toBeVisible();

    await act(async () => {
      olderResponse.resolve(executionResponse("older-id", "Older workflow"));
      await olderResponse.promise;
    });
    expect(screen.getByText("Latest workflow")).toBeVisible();
    expect(screen.queryByText("Older workflow")).not.toBeInTheDocument();
  });
});
