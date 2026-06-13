import { fireEvent, render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";
import { ExecutionsTable } from "./ExecutionsTable";

describe("ExecutionsTable", () => {
  it("keeps search controls visible when filters return no executions", () => {
    const setPage = vi.fn();
    const setSearch = vi.fn();

    render(
      <ExecutionsTable
        executions={[]}
        hasActiveFilters
        page={1}
        setPage={setPage}
        pageSize={10}
        setPageSize={vi.fn()}
        search="missing"
        setSearch={setSearch}
        total={0}
        totalPages={1}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search by workflow...");
    expect(searchInput).toBeVisible();
    expect(screen.getByText("No executions found")).toBeVisible();

    fireEvent.change(searchInput, { target: { value: "" } });

    expect(setSearch).toHaveBeenCalledWith("");
    expect(setPage).toHaveBeenCalledWith(1);
  });
});
