type TabRequest = { nodeId: string; tab: string } | null;

let _request: TabRequest = null;
const _listeners = new Set<() => void>();

export const agentTabStore = {
  request: (nodeId: string, tab: string) => {
    _request = { nodeId, tab };
    _listeners.forEach((l) => l());
  },
  consume: () => {
    _request = null;
  },
  getSnapshot: (): TabRequest => _request,
  subscribe: (listener: () => void) => {
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  },
};
