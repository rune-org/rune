import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/lib/auth";
import { render, screen } from "@/test/render";
import { router, setPathname } from "@/test/mocks/next-navigation";

import { RequireAuth } from "./RequireAuth";

function renderWithAuth(
  value: React.ContextType<typeof AuthContext>,
  children: ReactNode = <div>Secret</div>,
) {
  return render(
    <AuthContext.Provider value={value}>
      <RequireAuth>{children}</RequireAuth>
    </AuthContext.Provider>,
  );
}

describe("RequireAuth", () => {
  it("redirects to sign-in when rendered outside the auth provider", () => {
    render(
      <RequireAuth>
        <div>Secret</div>
      </RequireAuth>,
    );

    expect(router.replace).toHaveBeenCalledWith("/sign-in");
    expect(screen.getByText("Checking authentication…")).toBeInTheDocument();
  });

  it("redirects anonymous users back to sign-in with a return path", () => {
    setPathname("/create/app");

    renderWithAuth({
      state: { loading: false, user: null, error: null, isSsoOnly: false },
      login: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
      refetchProfile: vi.fn().mockResolvedValue(false),
    });

    expect(router.replace).toHaveBeenCalledWith("/sign-in?redirect=%2Fcreate%2Fapp");
  });

  it("forces password changes before rendering protected content", () => {
    renderWithAuth({
      state: {
        loading: false,
        user: { id: 1, role: "user", must_change_password: true } as never,
        error: null,
        isSsoOnly: false,
      },
      login: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
      refetchProfile: vi.fn().mockResolvedValue(true),
    });

    expect(router.replace).toHaveBeenCalledWith("/change-password");
    expect(screen.getByText("Everything is temporary.. even your password.")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("renders children for authenticated users", () => {
    const initialize = vi.fn().mockResolvedValue(undefined);

    renderWithAuth({
      state: {
        loading: false,
        user: { id: 1, role: "user", must_change_password: false } as never,
        error: null,
        isSsoOnly: false,
      },
      login: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      initialize,
      refetchProfile: vi.fn().mockResolvedValue(true),
    });

    expect(initialize).toHaveBeenCalled();
    expect(screen.getByText("Secret")).toBeInTheDocument();
  });
});
