import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge, ReactFlowInstance } from "@xyflow/react";
import type { CanvasNode } from "../types";
import type { SmithChatMessage } from "@/features/smith/SmithChatDrawer";
import { sanitizeGraph } from "../lib/graphIO";
import { applyAutoLayout } from "../lib/autoLayout";
import { canvasToWorkflowData, workflowDataToCanvas } from "@/lib/workflow-dsl";
import { smith } from "@/lib/api";
import type { TodoItem } from "@/lib/api/smith";
import { toast } from "@/components/ui/toast";

export type UseSmithOptions = {
  workflowId: number | null;
  readOnly?: boolean;
  pushHistory: () => void;
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  rfInstanceRef: React.RefObject<ReactFlowInstance<CanvasNode, Edge> | null>;
  /** Live canvas graph, read at send time so Smith edits what is on screen. */
  nodesRef: React.RefObject<CanvasNode[]>;
  edgesRef: React.RefObject<Edge[]>;
  /**
   * Ensure a persisted workflow exists and return its id (creating a shell when
   * the canvas has none yet). Smith threads its conversation on this id.
   */
  ensureWorkflow: () => Promise<number | null>;
};

export function useSmith(opts: UseSmithOptions) {
  const {
    workflowId,
    readOnly = false,
    pushHistory,
    setNodes,
    setEdges,
    rfInstanceRef,
    nodesRef,
    edgesRef,
    ensureWorkflow,
  } = opts;

  const [isSmithOpen, setIsSmithOpen] = useState(false);
  const [smithMessages, setSmithMessages] = useState<SmithChatMessage[]>([]);
  const [smithInput, setSmithInput] = useState("");
  const [smithSending, setSmithSending] = useState(false);
  const [smithShowTrace, setSmithShowTrace] = useState(true);
  const [smithJustFinished, setSmithJustFinished] = useState(false);
  const [pendingSmithPrompt, setPendingSmithPrompt] = useState<string | null>(null);
  const [smithTodos, setSmithTodos] = useState<TodoItem[]>([]);

  const smithSendingRef = useRef(false);
  const smithShowTraceRef = useRef(true);
  smithSendingRef.current = smithSending;
  smithShowTraceRef.current = smithShowTrace;

  const openSmith = useCallback(() => {
    if (readOnly) {
      toast.error("Smith is disabled while viewing history");
      return;
    }
    setIsSmithOpen(true);
    setSmithJustFinished(false);
  }, [readOnly]);

  const applySmithWorkflow = useCallback(
    (workflow: { nodes?: unknown; edges?: unknown }) => {
      if (readOnly) return;

      const candidateNodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
      const candidateEdges = Array.isArray(workflow.edges) ? workflow.edges : [];

      if (candidateNodes.length === 0) {
        return;
      }

      const { nodes: canvasNodes, edges: canvasEdges } = workflowDataToCanvas({
        nodes: candidateNodes as Parameters<typeof workflowDataToCanvas>[0]["nodes"],
        edges: candidateEdges as Parameters<typeof workflowDataToCanvas>[0]["edges"],
      });
      const sanitized = sanitizeGraph({
        nodes: canvasNodes,
        edges: canvasEdges,
      });
      const layouted = applyAutoLayout({
        nodes: sanitized.nodes as CanvasNode[],
        edges: sanitized.edges as Edge[],
        respectPinned: true,
      });

      pushHistory();
      setNodes(layouted.nodes as CanvasNode[]);
      setEdges(layouted.edges as Edge[]);

      // Fit view after nodes are rendered
      setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.2, duration: 200 });
      }, 50);

      toast.success("Smith updated the canvas");
    },
    [readOnly, pushHistory, setEdges, setNodes, rfInstanceRef],
  );

  const handleSmithSend = useCallback(
    async (content: string) => {
      if (readOnly) {
        toast.error("Smith is disabled while viewing history");
        return;
      }

      const trimmed = content.trim();
      if (!trimmed || smithSendingRef.current) return;

      const userMessage: SmithChatMessage = { role: "user", content: trimmed };
      setSmithMessages((prev) => [...prev, userMessage]);
      setSmithInput("");
      setSmithTodos([]);
      setSmithSending(true);

      // If reasoning mode is on, close the drawer to let user watch the canvas
      if (smithShowTraceRef.current) {
        setIsSmithOpen(false);
      }

      try {
        // Smith threads its conversation on a real workflow id; create a shell
        // first if the canvas isn't backed by one yet.
        const wfId = workflowId ?? (await ensureWorkflow());
        if (wfId == null) {
          toast.error("Couldn't prepare a workflow for Smith");
          return;
        }

        // Send the live on-screen graph so Smith edits exactly what the user
        // sees (work-in-progress nodes may lack credentials — that's fine here).
        const { nodes: dslNodes, edges: dslEdges } = canvasToWorkflowData(
          nodesRef.current ?? [],
          edgesRef.current ?? [],
          { ignoreMissingCredentials: true },
        );

        const { stream } = await smith.streamEditWorkflow(wfId, trimmed, dslNodes, dslEdges);

        let accumulatedContent = "";
        let hasWorkflowState = false;

        for await (const event of stream) {
          const sseEvent = event as smith.SmithSSEEvent;

          switch (sseEvent.type) {
            case "token":
              accumulatedContent += sseEvent.content;
              setSmithMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg?.role === "smith") {
                  return [...prev.slice(0, -1), { ...lastMsg, content: accumulatedContent }];
                } else {
                  return [...prev, { role: "smith", content: accumulatedContent }];
                }
              });
              break;

            case "workflow_state":
              hasWorkflowState = true;
              try {
                applySmithWorkflow({
                  nodes: sseEvent.workflow_nodes,
                  edges: sseEvent.workflow_edges,
                });
              } catch (_err) {
                toast.error("Failed to apply Smith's workflow changes");
              }
              if (sseEvent.todos) {
                setSmithTodos(sseEvent.todos);
              }
              break;

            case "error":
              toast.error(sseEvent.message || "Smith encountered an error");
              break;

            case "warning":
              console.warn("Smith warning:", sseEvent.message);
              break;

            case "tool_call":
              // Filter out todo tool calls -- the plan panel shows these
              if (sseEvent.name !== "create_todo_plan" && sseEvent.name !== "update_todo_status") {
                setSmithMessages((prev) => [
                  ...prev,
                  {
                    role: "tool_call" as const,
                    content: sseEvent.arguments || "{}",
                    toolName: sseEvent.name,
                  },
                ]);
              }
              break;
          }
        }

        if (!accumulatedContent && !hasWorkflowState) {
          setSmithMessages((prev) => [
            ...prev,
            { role: "smith", content: "I've processed your request." },
          ]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Smith could not generate the workflow");
      } finally {
        setSmithSending(false);
        if (smithShowTraceRef.current) {
          setSmithJustFinished(true);
        }
      }
    },
    [readOnly, applySmithWorkflow, workflowId, ensureWorkflow, nodesRef, edgesRef],
  );

  // Manually clear this workflow's Smith conversation (server thread + local
  // view). Deletes that chat only — never the workflow or other users' chats.
  const handleClearConversation = useCallback(async () => {
    if (readOnly || smithSendingRef.current) return;
    if (workflowId != null) {
      try {
        await smith.clearThread(workflowId);
      } catch {
        // Non-fatal: still reset the local view so the user gets a fresh chat.
      }
    }
    setSmithMessages([]);
    setSmithTodos([]);
    setSmithInput("");
    toast.success("Conversation cleared");
  }, [readOnly, workflowId]);

  useEffect(() => {
    if (readOnly) {
      setIsSmithOpen(false);
      setPendingSmithPrompt(null);
    }
  }, [readOnly]);

  // Greeting message when drawer opens
  useEffect(() => {
    if (isSmithOpen && smithMessages.length === 0) {
      setSmithMessages([
        {
          role: "smith",
          content:
            "Hi, I'm Smith. Describe what to build or edit and I'll wire the workflow for you.",
        },
      ]);
    }
  }, [isSmithOpen, smithMessages.length]);

  // Auto-run Smith prompt seeded from quickstart/local storage
  useEffect(() => {
    const smithPendingPrompt = localStorage.getItem("smith_pending_prompt");
    if (smithPendingPrompt) {
      setPendingSmithPrompt(smithPendingPrompt);
      localStorage.removeItem("smith_pending_prompt");
      return;
    }

    if (!workflowId) return;
    try {
      const savedPrompt = localStorage.getItem(`smith-prompt-${workflowId}`);
      const savedTracePref = localStorage.getItem(`smith-show-trace-${workflowId}`);
      if (savedPrompt) {
        setPendingSmithPrompt(savedPrompt);
        setSmithShowTrace(savedTracePref === "true");
        localStorage.removeItem(`smith-prompt-${workflowId}`);
        localStorage.removeItem(`smith-show-trace-${workflowId}`);
      }
    } catch {
      // ignore
    }
  }, [workflowId]);

  // Execute pending prompt
  useEffect(() => {
    if (readOnly) return;
    if (pendingSmithPrompt && !smithSending) {
      setIsSmithOpen(true);
      void handleSmithSend(pendingSmithPrompt);
      setPendingSmithPrompt(null);
    }
  }, [readOnly, pendingSmithPrompt, smithSending, handleSmithSend]);

  return {
    isSmithOpen,
    setIsSmithOpen,
    openSmith,
    smithMessages,
    smithInput,
    setSmithInput,
    smithSending,
    smithShowTrace,
    setSmithShowTrace,
    smithJustFinished,
    handleSmithSend,
    handleClearConversation,
    smithTodos,
  };
}
