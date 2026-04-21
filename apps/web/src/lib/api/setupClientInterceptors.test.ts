import { beforeEach, describe, expect, it, vi } from "vitest";

import { locationMock } from "@/test/mocks/browser";
import { ACCESS_EXP_KEY, REFRESH_TOKEN_KEY } from "@/lib/auth/constants";

type ResponseInterceptor = (
  response: Response,
  options: Record<string, unknown>,
) => Promise<Response>;

const mocks = vi.hoisted(() => {
  const state: { responseInterceptor: ResponseInterceptor | null } = {
    responseInterceptor: null,
  };

  return {
    state,
    responseUse: vi.fn((fn: ResponseInterceptor) => {
      state.responseInterceptor = fn;
    }),
    request: vi.fn(),
    refreshAccessToken: vi.fn(),
  };
});

vi.mock("@/client/client.gen", () => ({
  client: {
    interceptors: {
      response: {
        use: mocks.responseUse,
      },
    },
    request: mocks.request,
  },
}));

vi.mock("@/lib/api/auth", () => ({
  refreshAccessToken: mocks.refreshAccessToken,
}));

async function installInterceptor() {
  vi.resetModules();
  const { setupClientInterceptors } = await import("./setupClientInterceptors");
  setupClientInterceptors();

  if (!mocks.state.responseInterceptor) {
    throw new Error("Response interceptor was not installed");
  }

  return mocks.state.responseInterceptor;
}

describe("setupClientInterceptors", () => {
  beforeEach(() => {
    localStorage.clear();
    locationMock.pathname = "/create/app";
    locationMock.assign.mockClear();

    mocks.state.responseInterceptor = null;
    mocks.responseUse.mockClear();
    mocks.request.mockClear();
    mocks.refreshAccessToken.mockClear();
  });

  it("does not redirect anonymous users on 401 when no session evidence exists", async () => {
    const interceptor = await installInterceptor();
    const response = new Response("{}", { status: 401 });

    const result = await interceptor(response, {
      url: "/profile/me",
      headers: new Headers(),
      method: "GET",
    });

    expect(result).toBe(response);
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(locationMock.assign).not.toHaveBeenCalled();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(ACCESS_EXP_KEY)).toBeNull();
  });

  it("redirects to sign-in when session is invalid and no refresh token exists", async () => {
    localStorage.setItem(ACCESS_EXP_KEY, "123");

    const interceptor = await installInterceptor();
    const response = new Response("{}", { status: 401 });

    const result = await interceptor(response, {
      url: "/workflows/",
      headers: new Headers(),
      method: "POST",
    });

    expect(result).toBe(response);
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(locationMock.assign).toHaveBeenCalledWith(
      "/sign-in?reason=session-expired&redirect=%2Fcreate%2Fapp",
    );
    expect(localStorage.getItem(ACCESS_EXP_KEY)).toBeNull();
  });

  it("tries token refresh once and retries the request when refresh succeeds", async () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-token");
    mocks.refreshAccessToken.mockResolvedValue({});

    const retriedResponse = new Response("{}", { status: 200 });
    mocks.request.mockResolvedValue({ response: retriedResponse });

    const interceptor = await installInterceptor();
    const response = new Response("{}", { status: 401 });

    const result = await interceptor(response, {
      url: "/workflows/",
      headers: new Headers({ "x-custom": "1" }),
      method: "PATCH",
    });

    expect(mocks.refreshAccessToken).toHaveBeenCalledWith("refresh-token");
    expect(mocks.request).toHaveBeenCalledTimes(1);

    const requestArg = mocks.request.mock.calls[0]?.[0] as {
      headers: Headers;
      method: string;
      url: string;
    };

    expect(requestArg.url).toBe("/workflows/");
    expect(requestArg.method).toBe("PATCH");
    expect(requestArg.headers.get("x-custom")).toBe("1");
    expect(requestArg.headers.get("x-retried")).toBe("1");

    expect(result).toBe(retriedResponse);
    expect(locationMock.assign).not.toHaveBeenCalled();
  });

  it("clears auth state and redirects when refresh fails", async () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, "refresh-token");
    localStorage.setItem(ACCESS_EXP_KEY, "999");
    mocks.refreshAccessToken.mockRejectedValue(new Error("refresh failed"));

    const interceptor = await installInterceptor();
    const response = new Response("{}", { status: 401 });

    const result = await interceptor(response, {
      url: "/credentials/",
      headers: new Headers(),
      method: "GET",
    });

    expect(result).toBe(response);
    expect(locationMock.assign).toHaveBeenCalledWith(
      "/sign-in?reason=session-expired&redirect=%2Fcreate%2Fapp",
    );
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(ACCESS_EXP_KEY)).toBeNull();
  });

  it("does not redirect for auth routes", async () => {
    const interceptor = await installInterceptor();
    const response = new Response("{}", { status: 401 });

    await interceptor(response, {
      url: "/auth/refresh",
      headers: new Headers(),
      method: "POST",
    });

    expect(locationMock.assign).not.toHaveBeenCalled();
  });
});
