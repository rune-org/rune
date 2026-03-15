import { useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { fetchExecution } from "@/lib/api/rtes";
import { rtesDocToExecutionState } from "../lib/executionConversion";
import { useExecution } from "../context/ExecutionContext";

/**
 * Syncs the `?execution=` URL query parameter with the ExecutionContext.
 *
 * - On mount (or when the param changes), fetches the execution from RTES and
 *   dispatches LOAD_STATE to display it on the canvas.
 * - Exposes `setExecutionParam` so other components (e.g. ExecutionHistoryPanel)
 *   can update the URL when the user selects or clears a historical execution.
 * - Automatically strips the param when execution state is reset (e.g. new live run).
 */
export function useExecutionFromUrl(workflowId: number | null) {
  const params = useSearchParams();
  const router = useRouter();
  const { state, dispatch } = useExecution();

  const executionIdFromUrl = params.get("execution");
  const paramsString = params.toString();

  const prevIsHistoricalRef = useRef(state.isHistorical);

  // Update the URL's ?execution= param without a full navigation
  const setExecutionParam = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(paramsString);
      if (id) {
        next.set("execution", id);
      } else {
        next.delete("execution");
      }
      router.replace(`?${next.toString()}`);
    },
    [paramsString, router],
  );

  // Load execution from URL param
  useEffect(() => {
    if (!executionIdFromUrl || workflowId === null) return;

    if (state.executionId === executionIdFromUrl && state.isHistorical) return;

    let cancelled = false;

    (async () => {
      try {
        const doc = await fetchExecution(executionIdFromUrl, workflowId);
        if (cancelled) return;
        if (!doc) {
          toast.error("Execution not found");
          setExecutionParam(null);
          return;
        }
        const executionState = rtesDocToExecutionState(doc);
        dispatch({ type: "LOAD_STATE", state: executionState });
      } catch {
        if (cancelled) return;
        toast.error("Failed to load execution");
        setExecutionParam(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    executionIdFromUrl,
    workflowId,
    state.executionId,
    state.isHistorical,
    dispatch,
    setExecutionParam,
  ]);

  // Strip ?execution= from URL when leaving historical mode (e.g. new live run, reset)
  useEffect(() => {
    const wasHistorical = prevIsHistoricalRef.current;
    prevIsHistoricalRef.current = state.isHistorical;

    if (wasHistorical && !state.isHistorical && executionIdFromUrl) {
      setExecutionParam(null);
    }
  }, [state.isHistorical, executionIdFromUrl, setExecutionParam]);

  return { setExecutionParam };
}
