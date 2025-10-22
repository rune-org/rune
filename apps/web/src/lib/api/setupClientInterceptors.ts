"use client";

import { client } from "@/client/client.gen";
import type { HttpMethod } from "@/client/core/types.gen";
import { refreshAccessToken } from "@/lib/api/auth";

const REFRESH_TOKEN_KEY = "auth:refresh_token";
const ACCESS_EXP_KEY = "auth:access_exp";

let installed = false;
let refreshPromise: Promise<void> | null = null;

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
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
    if (window.location.pathname !== to) {
      window.location.assign(to);
    }
  }
}

async function ensureRefreshed() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const token = getRefreshToken();
      if (!token) throw new Error("Missing refresh token");
      const { error } = await refreshAccessToken(token);
      if (error) throw error;
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
    const isAuthRoute =
      typeof options.url === "string" && options.url.startsWith("/auth/");
    let retried = false;
    if (options.headers) {
      if (options.headers instanceof Headers) {
        retried = options.headers.get("x-retried") === "1";
      } else if (Array.isArray(options.headers)) {
        retried = (options.headers as [string, string][]).some(
          ([k, v]) => k.toLowerCase() === "x-retried" && v === "1",
        );
      } else if (typeof options.headers === "object") {
        const v = (options.headers as Record<string, unknown>)["x-retried"];
        retried = v === "1";
      }
    }
    if (response.status !== 401 || isAuthRoute || retried) {
      return response;
    }

    try {
      // If there is no refresh token stored, don't attempt refresh or redirect.
      const token = getRefreshToken();
      if (!token) {
        return response;
      }
      await ensureRefreshed();
    } catch {
      clearAuthAndRedirect();
      return response;
    }

    const headers = new Headers(options.headers as HeadersInit | undefined);
    headers.set("x-retried", "1");
    const result = await client.request({
      ...options,
      headers,
      method: (options.method ?? "GET") as Uppercase<HttpMethod>,
    });
    return result.response;
  });
}
