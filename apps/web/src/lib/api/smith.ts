import { clearThreadSmithWorkflowIdDelete, generateWorkflowSmithWorkflowIdPost } from "@/client";
import type { GenerateWorkflowRequest } from "@/client/types.gen";

export interface TodoItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "done";
  description?: string;
}

export type SmithSSEEvent =
  | { type: "stream_start" }
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; arguments: string; call_id: string }
  | { type: "tool_result"; output: string; call_id: string }
  | { type: "warning"; message: string }
  | {
      type: "workflow_state";
      workflow_nodes: WorkflowNode[];
      workflow_edges: WorkflowEdge[];
      todos?: TodoItem[];
    }
  | { type: "error"; message: string; trace?: string }
  | { type: "stream_end" };

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  trigger: boolean;
  parameters: Record<string, unknown>;
  output: Record<string, unknown>;
  position: [number, number];
}

export interface WorkflowEdge {
  id: string;
  src: string;
  dst: string;
  label?: string;
}

/**
 * Stream Smith over an existing workflow, sending the live canvas graph so the
 * agent edits exactly what is on screen. An empty graph means "build from
 * scratch". The caller must ensure the workflow exists first (so there is a real
 * id to thread the conversation on).
 */
export const streamEditWorkflow = (
  workflowId: number,
  prompt: string,
  nodes: unknown[],
  edges: unknown[],
) =>
  generateWorkflowSmithWorkflowIdPost({
    path: { workflow_id: workflowId },
    body: { prompt, nodes, edges } as unknown as GenerateWorkflowRequest,
  });

/**
 * Delete the current user's Smith conversation thread for one workflow. Clears
 * that chat only — it does not touch the workflow itself or other users' chats.
 */
export const clearThread = (workflowId: number) =>
  clearThreadSmithWorkflowIdDelete({ path: { workflow_id: workflowId } });
export type { GenerateWorkflowRequest };
