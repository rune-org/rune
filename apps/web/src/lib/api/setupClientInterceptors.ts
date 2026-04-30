"use client";

import { client } from "@/client/client.gen";
import type { HttpMethod } from "@/client/core/types.gen";
import { refreshAccessToken } from "@/lib/api/auth";
import { REFRESH_TOKEN_KEY, ACCESS_EXP_KEY } from "@/lib/auth/constants";

let installed = false;
let refreshPromise: Promise<void> | null = null;
let redirectingToSignIn = false;

const SESSION_EXPIRED_REASON = "session-expired";

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function hasSessionEvidence(): boolean {
  try {
    return Boolean(localStorage.getItem(ACCESS_EXP_KEY));
  } catch {
    return false;
  }
}

function clearAuthAndRedirect() {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ACCESS_EXP_KEY);
  } catch {}

  if (typeof window !== "undefined") {
    // Avoid infinite navigation during Next.js transitions
    const to = "/sign-in";
    if (window.location.pathname !== to && !redirectingToSignIn) {
      redirectingToSignIn = true;
      const params = new URLSearchParams({ reason: SESSION_EXPIRED_REASON });
      if (window.location.pathname) {
        params.set("redirect", window.location.pathname);
      }
      window.location.assign(`${to}?${params.toString()}`);
    }
  }
}

async function ensureRefreshed() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const token = getRefreshToken();
      if (!token) throw new Error("Missing refresh token");
      await refreshAccessToken(token);
    })()
      .catch((e) => {
        throw e;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function setupClientInterceptors() {
  if (installed) return;
  installed = true;

  client.interceptors.response.use(async (response, options) => {
    const isAuthRoute = typeof options.url === "string" && options.url.startsWith("/auth/");
    const normalized = new Headers(options.headers as HeadersInit | undefined);
    const retried = normalized.get("x-retried") === "1";
    if (response.status !== 401 || isAuthRoute || retried) {
      return response;
    }

    try {
      const token = getRefreshToken();
      if (!token) {
        // Anonymous users can legitimately get 401 on startup profile probes.
        // Only treat missing token as expired session when we have evidence
        // that a prior authenticated session existed in this browser.
        if (hasSessionEvidence()) {
          clearAuthAndRedirect();
        }
        return response;
      }

      await ensureRefreshed();
    } catch {
      clearAuthAndRedirect();
      return response;
    }

    const headers = normalized;
    headers.set("x-retried", "1");
    const result = await client.request({
      ...options,
      headers,
      method: (options.method ?? "GET") as Uppercase<HttpMethod>,
    });
    return result.response;
  });
}
