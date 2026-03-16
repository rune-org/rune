"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  refreshAccessToken as apiRefresh,
  getMyProfile as apiGetMyProfile,
  firstAdminSignup,
} from "@/lib/api/auth";
import { toast } from "@/components/ui/toast";
import { REFRESH_TOKEN_KEY, ACCESS_EXP_KEY } from "@/lib/auth/constants";
import type { UserResponse } from "@/client/types.gen";

type AuthUser = UserResponse;

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isSsoOnly: boolean;
};

type AuthContextValue = {
  state: AuthState;
  login: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  initialize: () => Promise<void>;
  refetchProfile: () => Promise<boolean>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const LEEWAY_SECONDS = 60; // refresh this many seconds before expiry

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isSsoOnly: false,
  });
  const initRef = useRef(false);
  const refreshTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setLoading = (loading: boolean) =>
    setState((s) => ({ ...s, loading, error: null }));
  const setError = (message: string | null) => setState((s) => ({ ...s, error: message }));
  const setSsoOnly = (isSsoOnly: boolean) => setState((s) => ({ ...s, isSsoOnly }));
  const setUser = (user: AuthUser | null) => setState((s) => ({ ...s, user }));

  const storeRefreshToken = (token: string | null) => {
    try {
      if (!token) {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } else {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
      }
    } catch {
      // ignore
    }
  };

  const getStoredRefreshToken = (): string | null => {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  };

  const storeAccessExp = (expMs: number | null) => {
    try {
      if (!expMs) {
        localStorage.removeItem(ACCESS_EXP_KEY);
      } else {
        localStorage.setItem(ACCESS_EXP_KEY, String(expMs));
      }
    } catch {
      // ignore
    }
  };

  const getStoredAccessExp = (): number | null => {
    try {
      const v = localStorage.getItem(ACCESS_EXP_KEY);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  };

  const clearScheduledRefresh = () => {
    if (refreshTimeoutId.current !== null) {
      clearTimeout(refreshTimeoutId.current!);
      refreshTimeoutId.current = null;
    }
  };

  const fetchProfile = useCallback(async () => {
    try {
      const response = await apiGetMyProfile();
      const profile = response.data?.data;
      if (profile) {
        setUser(profile);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    const token = getStoredRefreshToken();
    if (!token) return;
    try {
      const response = await apiRefresh(token);
      const payload = response.data?.data;
      if (payload) {
        // Update stored refresh token in case backend rotates (it currently does not)
        storeRefreshToken(payload.refresh_token ?? token);
        const expMs = Date.now() + payload.expires_in * 1000;
        storeAccessExp(expMs);
        // schedule next refresh
        clearScheduledRefresh();
        const leeway = Math.max(LEEWAY_SECONDS, Math.floor(payload.expires_in * 0.1));
        const delaySec = Math.max(payload.expires_in - leeway, 5);
        refreshTimeoutId.current = setTimeout(async () => {
          await refresh();
          await fetchProfile();
        }, delaySec * 1000);
      }
    } catch {
      // If refresh fails, clear all
      storeRefreshToken(null);
      storeAccessExp(null);
      clearScheduledRefresh();
      setUser(null);
    }
  }, [fetchProfile]);

  const initialize = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;
    setLoading(true);
    // Proactively refresh if token is near expiry
    const expMs = getStoredAccessExp();
    if (expMs) {
      const now = Date.now();
      const remainingSec = Math.max(0, Math.floor((expMs - now) / 1000));
      if (remainingSec <= LEEWAY_SECONDS) {
        await refresh();
      } else {
        // schedule next refresh
        clearScheduledRefresh();
        const leeway = Math.max(LEEWAY_SECONDS, Math.floor(remainingSec * 0.1));
        const delaySec = Math.max(remainingSec - leeway, 5);
        refreshTimeoutId.current = setTimeout(async () => {
          await refresh();
          await fetchProfile();
        }, delaySec * 1000);
      }
    }
    // Try to load profile; on failure attempt token refresh once, then try again
    const ok = await fetchProfile();
    if (!ok) {
      await refresh();
      await fetchProfile();
    }
    setLoading(false);
  }, [fetchProfile, refresh]);

  useEffect(() => {
    void initialize();
    return () => {
      clearScheduledRefresh();
    };
  }, [initialize]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      setSsoOnly(false);
      try {
        const response = await apiLogin(email, password);
        const payload = response.data?.data;
        if (!payload) {
          toast.error("Login failed");
          setError("Login failed");
          setLoading(false);
          return false;
        }
        // Save refresh token
        storeRefreshToken(payload.refresh_token);
        const expMs = Date.now() + payload.expires_in * 1000;
        storeAccessExp(expMs);
        // schedule next refresh
        clearScheduledRefresh();
        const leeway = Math.max(LEEWAY_SECONDS, Math.floor(payload.expires_in * 0.1));
        const delaySec = Math.max(payload.expires_in - leeway, 5);
        refreshTimeoutId.current = setTimeout(async () => {
          await refresh();
          await fetchProfile();
        }, delaySec * 1000);
        await fetchProfile();
        setLoading(false);
        return true;
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        // Check for SSO-only account trigger (403 with specific message)
        if (
          errorMessage ===
          "This account uses SSO. Please sign in via your organisation's identity provider."
        ) {
          setSsoOnly(true);
        } else {
          // Display error as toast notification for normal errors
          toast.error(errorMessage);
          setError(errorMessage);
        }
        setLoading(false);
        return false;
      }
    },
    [fetchProfile, refresh],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setLoading(true);
      setError(null);
      setSsoOnly(false);
      try {
        await firstAdminSignup(name, email, password);
        // Auto-login after successful registration
        return await login(email, password);
      } catch (error) {
        setError(getErrorMessage(error));
        setLoading(false);
        return false;
      }
    },
    [login],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    // Clear client state immediately
    storeRefreshToken(null);
    storeAccessExp(null);
    clearScheduledRefresh();
    setUser(null);
    // Fire-and-forget server logout; do not block UI on network
    void apiLogout().catch(() => {});
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login,
      signUp,
      logout,
      refresh,
      initialize,
      refetchProfile: fetchProfile,
    }),
    [state, login, signUp, logout, refresh, initialize, fetchProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function getErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    // Try to extract from ApiResponse format (message field)
    if (typeof e.message === "string") return e.message;
    // Try to extract detail (alternative error format)
    if (typeof e.detail === "string") return e.detail;
    // Check for error field
    if (typeof e.error === "string") return e.error;
  }
  return "Authentication failed. Please try again.";
}
