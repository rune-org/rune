"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { auth, workflows as workflowsApi } from "@/lib/api";
import type { UserResponse } from "@/client/types.gen";
import { listItemToWorkflowSummary, type WorkflowSummary } from "@/lib/workflows";
import { listWorkflowPermissions } from "@/lib/api/permissions";
import type { WorkflowRole } from "@/lib/permissions";

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
};

type Action =
  | { type: "start" }
  | { type: "error"; error: string }
  | { type: "setUser"; user: UserProfile }
  | { type: "setWorkflows"; workflows: WorkflowSummary[] };

const initialState: AppState = {
  user: null,
  workflows: [],
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
      };
    default:
      return state;
  }
}

type AppContextType = {
  state: AppState;
  actions: {
    init: () => Promise<void>;
    refreshWorkflows: () => Promise<void>;
  };
};

const AppContext = createContext<AppContextType | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const init = useCallback(async () => {
    try {
      dispatch({ type: "start" });
      const [profileRes, workflowsRes] = await Promise.all([
        auth.getMyProfile(),
        workflowsApi.listWorkflows(),
      ]);
      if (!profileRes.data) {
        throw new Error("Unable to load user profile");
      }
      if (!workflowsRes.data) {
        throw new Error("Unable to load workflows");
      }
      const userData = profileRes.data.data;
      dispatch({ type: "setUser", user: toUserProfile(userData) });
      const workflowItems = workflowsRes.data.data ?? [];
      
      // Fetch roles for each workflow
      const workflowsWithRoles = await Promise.all(
        workflowItems.map(async (item) => {
          try {
            const permissions = await listWorkflowPermissions(String(item.id));
            
            const currentUserPermission = permissions.find(
              (p) => {
                console.log(`Comparing permission user_id ${p.user_id} (${typeof p.user_id}) with current user ${userData.id} (${typeof userData.id})`);
                return p.user_id === userData.id || String(p.user_id) === String(userData.id);
              }
            );
            
            if (currentUserPermission) {
              console.log(`✓ Found role for workflow ${item.id}: ${currentUserPermission.role}`);
              return { ...listItemToWorkflowSummary(item), role: currentUserPermission.role };
            }
            
            console.warn(`⚠ User not found in permissions for workflow ${item.id}, defaulting to viewer`);
            return { ...listItemToWorkflowSummary(item), role: "viewer" as WorkflowRole };
          } catch (error) {
            console.error(`❌ Failed to fetch permissions for workflow ${item.id}:`, error);
            return { ...listItemToWorkflowSummary(item), role: "viewer" as WorkflowRole };
          }
        })
      );
      
      dispatch({
        type: "setWorkflows",
        workflows: workflowsWithRoles,
      });
    } catch (e) {
      dispatch({ type: "error", error: (e as Error).message });
    }
  }, []);

  const refreshWorkflows = useCallback(async () => {
    try {
      dispatch({ type: "start" });
      const [res, profileRes] = await Promise.all([
        workflowsApi.listWorkflows(),
        auth.getMyProfile(),
      ]);
      if (!res.data || !profileRes.data) {
        throw new Error("Unable to load workflows");
      }
      const items = res.data.data ?? [];
      const userData = profileRes.data.data;
      
      // Fetch roles for each workflow
      const workflowsWithRoles = await Promise.all(
        items.map(async (item) => {
          try {
            const permissions = await listWorkflowPermissions(String(item.id));
            console.log(`Workflow ${item.id} permissions:`, permissions);
            console.log(`Current user ID: ${userData.id}`);
            
            const currentUserPermission = permissions.find(
              (p) => {
                console.log(`Comparing permission user_id ${p.user_id} (${typeof p.user_id}) with current user ${userData.id} (${typeof userData.id})`);
                return p.user_id === userData.id || String(p.user_id) === String(userData.id);
              }
            );
            
            if (currentUserPermission) {
              console.log(`✓ Found role for workflow ${item.id}: ${currentUserPermission.role}`);
              return { ...listItemToWorkflowSummary(item), role: currentUserPermission.role };
            }
            
            console.warn(`⚠ User not found in permissions for workflow ${item.id}, defaulting to viewer`);
            return { ...listItemToWorkflowSummary(item), role: "viewer" as WorkflowRole };
          } catch (error) {
            console.error(`❌ Failed to fetch permissions for workflow ${item.id}:`, error);
            return { ...listItemToWorkflowSummary(item), role: "viewer" as WorkflowRole };
          }
        })
      );
      
      dispatch({
        type: "setWorkflows",
        workflows: workflowsWithRoles,
      });
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
