/**
 * RTES (Real-Time Execution Service) HTTP API client.
 * Fetches execution history from the RTES service.
 *
 * Auth flow:
 * 1. Call main API to publish access token to Redis (requires httpOnly JWT cookie)
 * 2. Call RTES to fetch data (validates via Redis token)
 */

import {
  getWorkflowExecutionsWorkflowsWorkflowIdExecutionsGet,
  getExecutionWorkflowsWorkflowIdExecutionsExecutionIdGet,
} from "@/client";
import { toast } from "@/components/ui/toast";

// Derive HTTP URL from WebSocket URL or use default
const RTES_WS_URL = process.env.NEXT_PUBLIC_RTES_WS_URL || "ws://localhost:3001/rt";
const RTES_BASE_URL = RTES_WS_URL
  .replace("wss://", "https://")
  .replace("ws://", "http://")
  .replace(/\/rt$/, "");

/**
 * Execution document from RTES (matches Rust ExecutionDocument)
 */
export interface RtesExecutionDocument {
  execution_id: string;
  workflow_id: string;
  status?: string;
  nodes: Record<string, RtesHydratedNode>;
  created_at?: string;
  updated_at?: string;
}

export interface RtesHydratedNode {
  latest?: RtesNodeExecutionInstance;
  lineages?: Record<string, RtesNodeExecutionInstance>;
  // Extra fields from node definition
  [key: string]: unknown;
}

export interface RtesNodeExecutionInstance {
  input?: unknown;
  parameters?: unknown;
  output?: unknown;
  status?: string;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
  executed_at?: string;
  duration_ms?: number;
  node_type?: string;
  name?: string;
}

/**
 * Fetch all executions for a workflow from RTES
 *
 * Auth flow:
 * 1. Calls main API to publish wildcard token to Redis
 * 2. Calls RTES to fetch executions (validates via Redis)
 */
export async function fetchWorkflowExecutions(
  workflowId: number
): Promise<RtesExecutionDocument[]> {
  try {
    // Step 1: Request access token from main API (publishes to Redis)
    const authResponse = await getWorkflowExecutionsWorkflowsWorkflowIdExecutionsGet({
      path: { workflow_id: workflowId },
    });

    if (authResponse.error || !authResponse.data?.success) {
      console.warn("[RTES API] Failed to get execution access from main API");
      return [];
    }

    // Step 2: Fetch from RTES (validates via Redis token)
    const response = await fetch(
      `${RTES_BASE_URL}/workflows/${workflowId}/executions`
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn("[RTES API] Unauthorized access to executions");
        return [];
      }
      throw new Error(`RTES API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    toast.error("Failed to fetch execution history");
    return [];
  }
}

/**
 * Fetch a specific execution by ID from RTES
 *
 * Auth flow:
 * 1. Calls main API to publish scoped token to Redis
 * 2. Calls RTES to fetch execution (validates via Redis)
 *
 * @param executionId - The execution ID
 * @param workflowId - The workflow ID (required for auth)
 */
export async function fetchExecution(
  executionId: string,
  workflowId: number
): Promise<RtesExecutionDocument | null> {
  try {
    // Step 1: Request access token from main API (publishes to Redis)
    const authResponse = await getExecutionWorkflowsWorkflowIdExecutionsExecutionIdGet({
      path: { workflow_id: workflowId, execution_id: executionId },
    });

    if (authResponse.error || !authResponse.data?.success) {
      console.warn("[RTES API] Failed to get execution access from main API");
      return null;
    }

    // Step 2: Fetch from RTES (validates via Redis token)
    const response = await fetch(
      `${RTES_BASE_URL}/executions/${executionId}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      if (response.status === 401 || response.status === 403) {
        console.warn("[RTES API] Unauthorized access to execution");
        return null;
      }
      throw new Error(`RTES API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    toast.error("Failed to fetch execution details");
    return null;
  }
}
