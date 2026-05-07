export type AgentTab = "model" | "prompt" | "tools" | "mcp";

export function isAgentTab(tab: string): tab is AgentTab {
  return tab === "model" || tab === "prompt" || tab === "tools" || tab === "mcp";
}

type TabRequest = { nodeId: string; tab: AgentTab } | null;

let _request: TabRequest = null;
const _listeners = new Set<() => void>();

export const agentTabStore = {
  request: (nodeId: string, tab: AgentTab) => {
    _request = { nodeId, tab };
    _listeners.forEach((l) => l());
  },
  consume: () => {
    _request = null;
  },
  getSnapshot: (): TabRequest => _request,
  getServerSnapshot: (): TabRequest => null,
  subscribe: (listener: () => void) => {
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  },
};
