import { generateNewWorkflowSmithPost } from "@/client";
import type { GenerateWorkflowRequest } from "@/client/types.gen";

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

export const streamGenerateNewWorkflow = (prompt: string) =>
  generateNewWorkflowSmithPost({
    body: { prompt },
  });
export type { GenerateWorkflowRequest };
