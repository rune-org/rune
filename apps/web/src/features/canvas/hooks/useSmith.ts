import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge, ReactFlowInstance } from "@xyflow/react";
import type { CanvasNode } from "../types";
import type { SmithChatMessage } from "@/features/smith/SmithChatDrawer";
import { sanitizeGraph } from "../lib/graphIO";
import { applyAutoLayout } from "../lib/autoLayout";
import { workflowDataToCanvas } from "@/lib/workflow-dsl";
import { smith } from "@/lib/api";
import { toast } from "@/components/ui/toast";

export type UseSmithOptions = {
  workflowId: number | null;
  pushHistory: () => void;
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  rfInstanceRef: React.RefObject<ReactFlowInstance<CanvasNode, Edge> | null>;
};

export function useSmith(opts: UseSmithOptions) {
  const { workflowId, pushHistory, setNodes, setEdges, rfInstanceRef } = opts;

  const [isSmithOpen, setIsSmithOpen] = useState(false);
  const [smithMessages, setSmithMessages] = useState<SmithChatMessage[]>([]);
  const [smithInput, setSmithInput] = useState("");
  const [smithSending, setSmithSending] = useState(false);
  const [smithShowTrace, setSmithShowTrace] = useState(true);
  const [smithJustFinished, setSmithJustFinished] = useState(false);
  const [pendingSmithPrompt, setPendingSmithPrompt] = useState<string | null>(null);

  const smithSendingRef = useRef(false);
  const smithShowTraceRef = useRef(true);
  smithSendingRef.current = smithSending;
  smithShowTraceRef.current = smithShowTrace;

  const openSmith = useCallback(() => {
    setIsSmithOpen(true);
    setSmithJustFinished(false);
  }, []);

  const applySmithWorkflow = useCallback(
    (workflow: { nodes?: unknown; edges?: unknown }) => {
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
    [pushHistory, setEdges, setNodes, rfInstanceRef],
  );

  const handleSmithSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || smithSendingRef.current) return;

      const userMessage: SmithChatMessage = { role: "user", content: trimmed };
      setSmithMessages((prev) => [...prev, userMessage]);
      setSmithInput("");
      setSmithSending(true);

      // If reasoning mode is on, close the drawer to let user watch the canvas
      if (smithShowTraceRef.current) {
        setIsSmithOpen(false);
      }

      try {
        const { stream } = await smith.streamGenerateNewWorkflow(trimmed);

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
                  return [
                    ...prev.slice(0, -1),
                    { ...lastMsg, content: accumulatedContent },
                  ];
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
              } catch (err) {
                toast.error("Failed to apply Smith's workflow changes");
              }
              break;

            case "error":
              toast.error(sseEvent.message || "Smith encountered an error");
              break;

            case "warning":
              console.warn("Smith warning:", sseEvent.message);
              break;

            case "tool_call":
              setSmithMessages((prev) => [
                ...prev,
                {
                  role: "tool_call" as const,
                  content: sseEvent.arguments || "{}",
                  toolName: sseEvent.name,
                },
              ]);
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
        toast.error(
          err instanceof Error
            ? err.message
            : "Smith could not generate the workflow",
        );
      } finally {
        setSmithSending(false);
        if (smithShowTraceRef.current) {
          setSmithJustFinished(true);
        }
      }
    },
    [applySmithWorkflow],
  );

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
      const savedTracePref = localStorage.getItem(
        `smith-show-trace-${workflowId}`,
      );
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
    if (pendingSmithPrompt && !smithSending) {
      setIsSmithOpen(true);
      void handleSmithSend(pendingSmithPrompt);
      setPendingSmithPrompt(null);
    }
  }, [pendingSmithPrompt, smithSending, handleSmithSend]);

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
  };
}
