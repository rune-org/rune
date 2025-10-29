// Types and helpers for the frontend representation of the Workflow DSL

import type { Edge as RFEdge } from "@xyflow/react";
import type { CSSProperties } from "react";
import type {
  CanvasNode,
  HttpData,
  IfData,
  SmtpData,
} from "@/features/canvas/types";
import { isCredentialRef, nodeTypeRequiresCredential } from "@/lib/credentials";
import type { CredentialRef } from "@/lib/credentials";

export type UUID = string;

export type EdgeStyle = "solid" | "dashed";
export type EdgeKind = "success" | "error";
export type ErrorStrategy = "halt" | "ignore" | "branch";

export interface NodeErrorConfig {
  type: ErrorStrategy;
  error_edge?: UUID;
}

export interface WorkflowNode<Params = Record<string, unknown>> {
  id: UUID;
  name: string;
  trigger: boolean;
  type: string;
  parameters: Params;
  credentials?: CredentialRef;
  output: Record<string, unknown>;
  error?: NodeErrorConfig;
  position?: [number, number];
}

export interface WorkflowEdge {
  id: UUID;
  src: UUID;
  dst: UUID;
  style?: EdgeStyle;
  label?: string;
  is_error?: EdgeKind;
}

export interface WorkflowCredential extends CredentialRef {
  // Values are opaque for the UI; should be partial or empty
  // depending on whether we will be showing secrets in the UI or not.
  // For mock data, we are including fields for demonstration.
  [key: string]: unknown;
}

export interface WorkflowDefinition {
  id: UUID;
  name: string;
  desc?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  active: boolean;
  credentials: WorkflowCredential[];
}

export interface UserProfile {
  id: UUID;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface TemplateSummary {
  id: UUID;
  title: string;
  description: string;
  from?: string;
  to?: string;
}

export interface ExecutionHistoryItem {
  id: UUID;
  workflowId: UUID;
  status: "running" | "success" | "failed" | "canceled";
  startedAt: string; // ISO date
  finishedAt?: string; // ISO date
}

// Worker payload (what rune-worker expects) - minimized execution schema
export interface WorkerEdge {
  id: UUID;
  src: UUID;
  dst: UUID;
}

export interface WorkerNode<
  Params = Record<string, unknown>,
> {
  id: UUID;
  name: string;
  trigger: boolean;
  type: string;
  parameters: Params;
  credentials?: CredentialRef;
  output: Record<string, unknown>;
  error?: NodeErrorConfig;
}

export interface WorkerWorkflow<Params = Record<string, unknown>> {
  workflow_id: UUID;
  execution_id: UUID;
  nodes: WorkerNode<Params>[];
  edges: WorkerEdge[];
}

export class MissingNodeCredentialsError extends Error {
  constructor(
    public readonly nodes: Array<{ id: UUID; type: string }>,
  ) {
    super(
      `Missing credentials for nodes: ${nodes
        .map((n) => `${n.type} (${n.id})`)
        .join(", ")}`,
    );
    this.name = "MissingNodeCredentialsError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ————————————————————————————————————————————————————————————————
// Converters between ReactFlow canvas graph and DSL/worker payloads
// ————————————————————————————————————————————————————————————————

// Map canvas node type to worker DSL type identifiers
function toWorkerType(canvasType: string): string {
  switch (canvasType) {
    case "trigger":
      return "ManualTrigger";
    case "if":
      return "conditional";
    case "http":
      return "http";
    case "smtp":
      return "smtp";
    case "agent":
      return "agent";
    default:
      return canvasType;
  }
}

// Human-friendly node naming
function nodeName(n: CanvasNode): string {
  const base = (n.data as { label?: string }).label;
  if (base && base.trim()) return base.trim();
  return n.type.charAt(0).toUpperCase() + n.type.slice(1);
}

// Build parameter objects for supported node types
function toWorkerParameters(
  n: CanvasNode,
  edges: RFEdge[],
): Record<string, unknown> {
  switch (n.type) {
    case "http": {
      const d = (n.data || {}) as HttpData;
      const params: Record<string, unknown> = {};
      if (d.method) params.method = String(d.method).toUpperCase();
      if (d.url) params.url = String(d.url);
      if (d.headers && typeof d.headers === "object")
        params.headers = d.headers;
      if (d.query && typeof d.query === "object") params.query = d.query;
      if (typeof d.body !== "undefined") params.body = d.body as unknown;
      if (typeof d.timeout !== "undefined") params.timeout = Number(d.timeout);
      if (typeof d.retries !== "undefined") params.retry = Number(d.retries);
      if (typeof d.ignoreSSL !== "undefined") params.ignore_ssl = !!d.ignoreSSL;
      return params;
    }
    case "if": {
      // Map labeled handles to true/false edge IDs
      const outgoing = edges.filter((e) => e.source === n.id);
      const trueEdge = outgoing.find(
        (e) =>
          (e as RFEdge & { sourceHandle?: string }).sourceHandle === "true",
      );
      const falseEdge = outgoing.find(
        (e) =>
          (e as RFEdge & { sourceHandle?: string }).sourceHandle === "false",
      );
      const params: Record<string, unknown> = {};
      if (trueEdge) params.true_edge_id = trueEdge.id;
      if (falseEdge) params.false_edge_id = falseEdge.id;
      // UI currently stores a single expression string; carry it through for future evaluation
      const d = (n.data || {}) as IfData;
      if (typeof d.expression === "string" && d.expression.trim()) {
        params.expression = d.expression.trim();
      }
      return params;
    }
    case "smtp": {
      const d = (n.data || {}) as SmtpData;
      const params: Record<string, unknown> = {};
      if (d.subject) params.subject = String(d.subject);
      if (d.to) params.to = String(d.to);
      // TODO(ui): from/cc/bcc.
      return params;
    }
    default:
      return {};
  }
}

type NodeHydrator = (
  base: CanvasNode["data"],
  params: Record<string, unknown>,
) => CanvasNode["data"];

const nodeHydrators: Partial<Record<CanvasNode["type"], NodeHydrator>> = {
  http: (base, params) => {
    const httpData: HttpData = {
      ...base,
      method:
        typeof params.method === "string"
          ? (params.method.toUpperCase() as HttpData["method"])
          : undefined,
      url: typeof params.url === "string" ? params.url : undefined,
      headers:
        params.headers && typeof params.headers === "object"
          ? (params.headers as Record<string, unknown>)
          : undefined,
      query:
        params.query && typeof params.query === "object"
          ? (params.query as Record<string, unknown>)
          : undefined,
      body: params.body,
      timeout:
        typeof params.timeout === "number"
          ? params.timeout
          : typeof params.timeout === "string"
            ? Number(params.timeout)
            : undefined,
      retries:
        typeof params.retry === "number"
          ? params.retry
          : typeof params.retry === "string"
            ? Number(params.retry)
            : undefined,
      ignoreSSL:
        typeof params.ignore_ssl === "boolean" ? params.ignore_ssl : undefined,
    };
    return httpData;
  },
  if: (base, params) => {
    const ifData: IfData = {
      ...base,
      expression:
        typeof params.expression === "string" ? params.expression : undefined,
    };
    return ifData;
  },
  smtp: (base, params) => {
    const smtpData: SmtpData = {
      ...base,
      subject:
        typeof params.subject === "string" ? params.subject : undefined,
      to: typeof params.to === "string" ? params.to : undefined,
    };
    return smtpData;
  },
};

function extractNodeCredential(node: CanvasNode): CredentialRef | undefined {
  const data = (node.data ?? {}) as { credential?: unknown };
  const candidate = data.credential;
  if (!candidate) return undefined;
  if (isCredentialRef(candidate)) {
    return { ...candidate };
  }
  return undefined;
}

// Convert Canvas graph to worker payload
export function canvasToWorkerWorkflow(
  workflowId: UUID,
  executionId: UUID,
  nodes: CanvasNode[],
  edges: RFEdge[],
): WorkerWorkflow {
  // Exclude unsupported types from worker payload for now (e.g., agent)
  const supported = new Set(["trigger", "if", "http", "smtp"]);
  const filteredNodes = nodes.filter((n) => supported.has(n.type));

  const missingCredentials: Array<{ id: UUID; type: string }> = [];

  const workerNodes: WorkerNode[] = filteredNodes.map((n) => {
    const credential = extractNodeCredential(n);
    if (nodeTypeRequiresCredential(n.type) && !credential) {
      missingCredentials.push({ id: n.id, type: n.type });
    }

    return {
      id: n.id,
      name: nodeName(n),
      trigger: n.type === "trigger",
      type: toWorkerType(n.type),
      parameters: toWorkerParameters(n, edges),
      credentials: credential,
      output: {},
    };
  });

  if (missingCredentials.length > 0) {
    throw new MissingNodeCredentialsError(missingCredentials);
  }

  const workerEdges: WorkerEdge[] = edges
    .filter(
      (e) =>
        filteredNodes.some((n) => n.id === e.source) &&
        filteredNodes.some((n) => n.id === e.target),
    )
    .map((e) => ({ id: e.id, src: String(e.source), dst: String(e.target) }));

  return {
    workflow_id: workflowId,
    execution_id: executionId,
    nodes: workerNodes,
    edges: workerEdges,
  };
}

// Convert Canvas graph to a workflow_data blueprint (stored in API)
export function canvasToWorkflowData(
  nodes: CanvasNode[],
  edges: RFEdge[],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const missingCredentials: Array<{ id: UUID; type: string }> = [];

  const blueprintNodes: WorkflowNode[] = nodes.map((n) => {
    const credential = extractNodeCredential(n);
    if (nodeTypeRequiresCredential(n.type) && !credential) {
      missingCredentials.push({ id: n.id, type: n.type });
    }

    return {
      id: n.id,
      name: nodeName(n),
      trigger: n.type === "trigger",
      type: toWorkerType(n.type), // store canonical type to simplify future use
      parameters: toWorkerParameters(n, edges),
      output: {},
      position: [n.position.x, n.position.y],
      credentials: credential,
    };
  });

  const blueprintEdges: WorkflowEdge[] = edges.map((e) => ({
    id: e.id,
    src: String(e.source),
    dst: String(e.target),
    label: (e as RFEdge & { label?: string }).label,
  }));

  if (missingCredentials.length > 0) {
    throw new MissingNodeCredentialsError(missingCredentials);
  }

  return { nodes: blueprintNodes, edges: blueprintEdges };
}

// Convert stored workflow_data blueprint back to Canvas graph for editing
export function workflowDataToCanvas(data: {
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}): { nodes: CanvasNode[]; edges: RFEdge[] } {
  const nodes: CanvasNode[] = (data.nodes ?? []).map((n) => {
    const [x, y] = (n.position ?? [100, 100]) as [number, number];
    // Map canonical type back to canvas palette names
    const canvasType =
      n.type === "conditional"
        ? "if"
        : n.type === "ManualTrigger"
          ? "trigger"
          : n.type;
    const credentials = n.credentials ? { ...n.credentials } : undefined;
    const baseData = {
      label: n.name,
      ...(credentials ? { credential: credentials } : {}),
    } as CanvasNode["data"];
    const params = (n.parameters ?? {}) as Record<string, unknown>;
    const hydrateDataForNode =
      nodeHydrators[canvasType as CanvasNode["type"]] ??
      ((existing) => existing);
    const dataForNode = hydrateDataForNode(baseData, params);
    return {
      id: n.id,
      type: canvasType as CanvasNode["type"],
      position: { x, y },
      data: dataForNode,
    } as CanvasNode;
  });

  const edges: RFEdge[] = (data.edges ?? []).map((e) => {
    const edge: RFEdge = {
      id: e.id,
      source: e.src,
      target: e.dst,
      type: "default",
      label: e.label,
    } as RFEdge;

    if (e.label === "true" || e.label === "false") {
      const isTrue = e.label === "true";
      (edge as RFEdge & { sourceHandle?: string }).sourceHandle = e.label;
      (edge as RFEdge & { labelStyle?: CSSProperties }).labelStyle = {
        fill: "white",
        fontWeight: 600,
      };
      (edge as RFEdge & { labelShowBg?: boolean }).labelShowBg = true;
      (edge as RFEdge & { labelBgStyle?: CSSProperties }).labelBgStyle = {
        fill: isTrue ? "hsl(142 70% 45%)" : "hsl(0 70% 50%)",
      };
      (edge as RFEdge & { labelBgPadding?: [number, number] }).labelBgPadding = [
        2,
        6,
      ];
      (edge as RFEdge & { labelBgBorderRadius?: number }).labelBgBorderRadius = 4;
    }

    return edge;
  });

  return { nodes, edges };
}
