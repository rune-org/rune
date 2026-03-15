import { useCallback, useEffect, useMemo, useState } from "react";

import type { ExecutionListItem as ApiExecutionListItem } from "@/client/types.gen";
import { listUserExecutions } from "@/lib/api/workflows";

export function useWorkflowExecutionsLookup() {
  const [executionItems, setExecutionItems] = useState<ApiExecutionListItem[]>([]);
  const [executionsLoaded, setExecutionsLoaded] = useState(false);

  const refreshExecutions = useCallback(async () => {
    try {
      const response = await listUserExecutions();
      const items = response.data?.data;
      if (items) {
        setExecutionItems((prev) => {
          if (
            prev.length === items.length &&
            prev.every((item, index) => item.id === items[index].id)
          ) {
            return prev;
          }
          return items;
        });
      }
    } catch {
      // Keep table rendering resilient; show N/A when executions cannot be loaded.
    } finally {
      setExecutionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshExecutions();
  }, [refreshExecutions]);

  const lastRunByWorkflow = useMemo(() => {
    const map = new Map<string, ApiExecutionListItem>();
    for (const execution of executionItems) {
      const key = String(execution.workflow_id);
      const existing = map.get(key);
      if (!existing || execution.created_at > existing.created_at) {
        map.set(key, execution);
      }
    }
    return map;
  }, [executionItems]);

  return {
    executionsLoaded,
    executionItems,
    lastRunByWorkflow,
    refreshExecutions,
  };
}
