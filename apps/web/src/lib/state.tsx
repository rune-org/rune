"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";

import { auth, workflows as workflowsApi } from "@/lib/api";
import type { UserResponse, WorkflowStatus } from "@/client/types.gen";
import { listItemToWorkflowSummary, type WorkflowSummary } from "@/lib/workflows";

type UserProfile = {
  id: string;
  name: string;
  email: string;
};

type AppState = {
  user: UserProfile | null;
  workflows: WorkflowSummary[];
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null;
};

type Action =
  | { type: "start" }
  | { type: "error"; error: string }
  | { type: "setUser"; user: UserProfile }
  | { type: "setWorkflows"; workflows: WorkflowSummary[]; pagination: AppState["pagination"] };

const initialState: AppState = {
  user: null,
  workflows: [],
  loading: false,
  error: null,
  pagination: null,
};

function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

function toUserProfile(user: UserResponse): UserProfile {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "start":
      return { ...state, loading: true, error: null };
    case "error":
      return { ...state, loading: false, error: action.error };
    case "setUser":
      return { ...state, loading: false, user: action.user };
    case "setWorkflows":
      return {
        ...state,
        loading: false,
        workflows: dedupeById(action.workflows),
        pagination: action.pagination,
      };
    default:
      return state;
  }
}

type AppContextType = {
  state: AppState;
  actions: {
    init: () => Promise<void>;
    refreshWorkflows: (params?: {
      page?: number;
      page_size?: number;
      search?: string;
      status?: WorkflowStatus;
    }) => Promise<void>;
  };
};

const AppContext = createContext<AppContextType | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const init = useCallback(async () => {
    try {
      dispatch({ type: "start" });
      const profileRes = await auth.getMyProfile();
      if (!profileRes.data) {
        throw new Error("Unable to load user profile");
      }
      const userData = profileRes.data.data;
      dispatch({ type: "setUser", user: toUserProfile(userData) });
    } catch (e) {
      dispatch({ type: "error", error: (e as Error).message });
    }
  }, []);

  const refreshWorkflows = useCallback(
    async (params?: {
      page?: number;
      page_size?: number;
      search?: string;
      status?: WorkflowStatus;
    }) => {
      try {
        dispatch({ type: "start" });
        const res = await workflowsApi.listWorkflows(params);
        if (!res.data) {
          throw new Error("Unable to load workflows");
        }
        const resData = res.data.data;
        const workflowItems = Array.isArray(resData) ? resData : (resData?.items ?? []);
        const pagination =
          Array.isArray(resData) || !resData
            ? null
            : {
                total: resData.total,
                page: resData.page,
                pageSize: resData.page_size,
                totalPages: resData.total_pages,
              };

        dispatch({
          type: "setWorkflows",
          workflows: workflowItems.map((item) => listItemToWorkflowSummary(item)),
          pagination,
        });
      } catch (e) {
        dispatch({ type: "error", error: (e as Error).message });
      }
    },
    [],
  );

  const actions = useMemo(() => ({ init, refreshWorkflows }), [init, refreshWorkflows]);

  const value = useMemo<AppContextType>(() => ({ state, actions }), [state, actions]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
