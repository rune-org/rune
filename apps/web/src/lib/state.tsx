"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { ApiMock, type WorkflowSummary } from "./api-mock";
import type {
  ExecutionHistoryItem,
  TemplateSummary,
  UserProfile,
} from "./workflow-dsl";

type AppState = {
  user: UserProfile | null;
  workflows: WorkflowSummary[];
  templates: TemplateSummary[];
  executions: ExecutionHistoryItem[];
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: "start" }
  | { type: "error"; error: string }
  | { type: "setUser"; user: UserProfile }
  | { type: "setWorkflows"; workflows: WorkflowSummary[] }
  | { type: "setTemplates"; templates: TemplateSummary[] }
  | { type: "setExecutions"; executions: ExecutionHistoryItem[] };

const initialState: AppState = {
  user: null,
  workflows: [],
  templates: [],
  executions: [],
  loading: false,
  error: null,
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
      };
    case "setTemplates":
      return { ...state, loading: false, templates: action.templates };
    case "setExecutions":
      return { ...state, loading: false, executions: action.executions };
    default:
      return state;
  }
}

type AppContextType = {
  state: AppState;
  actions: {
    init: () => Promise<void>;
    refreshWorkflows: () => Promise<void>;
    // TODO: Mutating actions (create/update/delete) are intentionally
    // unimplemented and should be implemented via backend APIs.
  };
};

const AppContext = createContext<AppContextType | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const init = useCallback(async () => {
    try {
      dispatch({ type: "start" });
      const [user, workflows] = await Promise.all([
        ApiMock.getUserProfile(),
        ApiMock.getWorkflows(),
      ]);
      dispatch({ type: "setUser", user });
      dispatch({ type: "setWorkflows", workflows });
    } catch (e) {
      dispatch({ type: "error", error: (e as Error).message });
    }
  }, []);

  const refreshWorkflows = useCallback(async () => {
    try {
      dispatch({ type: "start" });
      const list = await ApiMock.getWorkflows();
      dispatch({ type: "setWorkflows", workflows: list });
    } catch (e) {
      dispatch({ type: "error", error: (e as Error).message });
    }
  }, []);

  const value = useMemo<AppContextType>(
    () => ({ state, actions: { init, refreshWorkflows } }),
    [state, init, refreshWorkflows],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
