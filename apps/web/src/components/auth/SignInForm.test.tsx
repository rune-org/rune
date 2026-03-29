import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { render, screen } from "@/test/render";
import { locationMock } from "@/test/mocks/browser";
import { router, setSearchParams } from "@/test/mocks/next-navigation";

const authMock = vi.hoisted(() => ({
  state: {
    loading: false,
    error: null as string | null,
    isSsoOnly: false,
    user: null,
  },
  login: vi.fn<(email: string, password: string) => Promise<boolean>>(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => authMock,
}));

import { SignInForm } from "./SignInForm";

describe("SignInForm", () => {
  beforeEach(() => {
    authMock.state.loading = false;
    authMock.state.error = null;
    authMock.state.isSsoOnly = false;
    authMock.login.mockReset();
    authMock.login.mockResolvedValue(false);
    setSearchParams("");
  });

  it("submits credentials and redirects to allowed paths", async () => {
    const user = userEvent.setup();
    authMock.login.mockResolvedValue(true);
    setSearchParams({ redirect: "/create/app" });

    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(authMock.login).toHaveBeenCalledWith("user@example.com", "secret");
    expect(router.push).toHaveBeenCalledWith("/create/app");
  });

  it("falls back to /create for unsafe redirects", async () => {
    const user = userEvent.setup();
    authMock.login.mockResolvedValue(true);
    setSearchParams({ redirect: "/totally-not-allowed" });

    render(<SignInForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(router.push).toHaveBeenCalledWith("/create");
  });

  it("renders SSO guidance and uses a validated SSO redirect", async () => {
    const user = userEvent.setup();
    authMock.state.isSsoOnly = true;
    authMock.state.error = "Hidden while SSO-only";
    setSearchParams({ redirect: "/admin" });

    render(<SignInForm />);

    expect(screen.getByRole("alert")).toHaveTextContent("Single Sign-On");
    expect(screen.queryByText("Hidden while SSO-only")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign in with SSO" }));

    expect(locationMock.href).toBe("http://localhost:8000/auth/saml/login?redirect=%2Fadmin");
  });
});
