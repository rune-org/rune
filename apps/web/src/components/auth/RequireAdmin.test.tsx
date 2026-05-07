import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RequireAdmin } from "./RequireAdmin";

const replaceMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => useAuthMock(),
}));

describe("RequireAdmin", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    useAuthMock.mockReset();
  });

  it("shows loading while user is not available", () => {
    useAuthMock.mockReturnValue({
      state: { user: null },
    });

    render(
      <RequireAdmin>
        <div>secret</div>
      </RequireAdmin>,
    );

    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("renders children for admin user", () => {
    useAuthMock.mockReturnValue({
      state: { user: { role: "admin" } },
    });

    render(
      <RequireAdmin>
        <div>admin content</div>
      </RequireAdmin>,
    );

    expect(screen.getByText("admin content")).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects and blocks rendering for non-admin user", async () => {
    useAuthMock.mockReturnValue({
      state: { user: { role: "viewer" } },
    });

    const { container } = render(
      <RequireAdmin>
        <div>forbidden content</div>
      </RequireAdmin>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/create");
    });
    expect(container.firstChild).toBeNull();
  });
});
