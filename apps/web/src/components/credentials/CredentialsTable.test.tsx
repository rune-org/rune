import { fireEvent, render, screen } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CredentialsTable } from "./CredentialsTable";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ state: { user: { id: 1 } } }),
}));

vi.mock("@/lib/api/credentials", () => ({
  getMyShareInfo: vi.fn(),
  revokeCredentialAccess: vi.fn(),
}));

vi.mock("@/lib/api/users", () => ({
  getUserById: vi.fn(),
}));

describe("CredentialsTable", () => {
  const props = {
    credentials: [],
    page: 3,
    setPage: vi.fn(),
    pageSize: 10,
    setPageSize: vi.fn(),
    query: "",
    setQuery: vi.fn(),
    typeFilter: "all" as const,
    setTypeFilter: vi.fn(),
    total: 0,
    totalPages: 1,
  };

  beforeEach(() => {
    props.setPage.mockReset();
    props.setQuery.mockReset();
    props.setTypeFilter.mockReset();
  });

  it("resets to the first page when search changes", () => {
    render(<CredentialsTable {...props} />);

    fireEvent.change(screen.getByPlaceholderText("Search credentials..."), {
      target: { value: "github" },
    });

    expect(props.setQuery).toHaveBeenCalledWith("github");
    expect(props.setPage).toHaveBeenCalledWith(1);
  });

  it("resets to the first page when the type filter changes", async () => {
    render(<CredentialsTable {...props} />);

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "OAuth2" }));

    expect(props.setTypeFilter).toHaveBeenCalledWith("oauth2");
    expect(props.setPage).toHaveBeenCalledWith(1);
  });
});
