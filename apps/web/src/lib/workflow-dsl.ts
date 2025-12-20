// Types and helpers for the frontend representation of the Workflow DSL

import type { Edge as RFEdge } from "@xyflow/react";
import type { CSSProperties } from "react";
import type {
  CanvasNode,
  HttpData,
  IfData,
  SwitchData,
  SwitchRule,
  SmtpData,
  ScheduledData,
} from "@/features/canvas/types";
import { isCredentialRef, nodeTypeRequiresCredential } from "@/lib/credentials";
import type { CredentialRef } from "@/lib/credentials";
import {
  switchFallbackHandleId,
  switchHandleIdFromLabel,
  switchHandleLabelFromId,
  switchRuleHandleId,
} from "@/features/canvas/utils/switchHandles";

export interface WorkflowNode<Params = Record<string, unknown>> {
  id: string;
  name: string;
  trigger: boolean;
  type: string;
  parameters: Params;
  credentials?: CredentialRef;
  output: Record<string, unknown>;
  position?: [number, number];
}

export interface WorkflowEdge {
  id: string;
  src: string;
  dst: string;
  label?: string;
}

export class MissingNodeCredentialsError extends Error {
  constructor(
    public readonly nodes: Array<{ id: string; type: string }>,
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
    case "scheduled":
      return "ScheduleTrigger";
    case "if":
      return "conditional";
    case "switch":
      return "switch";
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

// Helper to convert comma-separated email string to array
function emailStringToArray(value: string | undefined): string[] | string | undefined {
  if (!value || !value.trim()) return undefined;
  const emails = value
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
  // Return single string if only one email, array if multiple
  return emails.length === 1 ? emails[0] : emails.length > 1 ? emails : undefined;
}

// Helper to convert array or single string back to comma-separated string for UI
function emailArrayToString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const emails = value.filter((v) => typeof v === "string") as string[];
    return emails.length > 0 ? emails.join(", ") : undefined;
  }
  return undefined;
}

// Build parameter objects for supported node types
function toWorkerParameters(
  n: CanvasNode,
  edges: RFEdge[],
): Record<string, unknown> {
  switch (n.type) {
    case "scheduled": {
      const d = (n.data || {}) as ScheduledData;
      const params: Record<string, unknown> = {};
      
      if (d.start_at) params.start_at = d.start_at;
      if (typeof d.interval_seconds === "number" && d.interval_seconds > 0) {
        params.interval_seconds = d.interval_seconds;
      }
      if (typeof d.is_active === "boolean") {
        params.is_active = d.is_active;
      }
      
      return params;
    }
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
    case "switch": {
      const d = (n.data || {}) as SwitchData;
      const rules = Array.isArray(d.rules)
        ? d.rules.map((rule) => {
            const operator = rule.operator;
            const safeOp: SwitchRule["operator"] =
              operator === "==" ||
              operator === "!=" ||
              operator === ">" ||
              operator === "<" ||
              operator === ">=" ||
              operator === "<=" ||
              operator === "contains"
                ? operator
                : "==";
            return {
              value:
                typeof rule.value === "string" && rule.value.trim()
                  ? rule.value.trim()
                  : undefined,
              operator: safeOp,
              compare:
                typeof rule.compare === "string" && rule.compare.trim()
                  ? rule.compare.trim()
                  : undefined,
            } as SwitchRule;
          })
        : [];

      const outgoing = edges.filter((e) => e.source === n.id);
      const routes: Array<string | null> = Array(rules.length + 1).fill(null);
      rules.forEach((_, idx) => {
        const edge = outgoing.find(
          (e) =>
            (e as RFEdge & { sourceHandle?: string }).sourceHandle ===
            switchRuleHandleId(idx),
        );
        if (edge) routes[idx] = edge.id;
      });
      const fallbackEdge = outgoing.find(
        (e) =>
          (e as RFEdge & { sourceHandle?: string }).sourceHandle ===
          switchFallbackHandleId(),
      );
      if (fallbackEdge) routes[rules.length] = fallbackEdge.id;

      const params: Record<string, unknown> = {};
      if (rules.length > 0) params.rules = rules;
      if (routes.some((r) => !!r)) params.routes = routes;
      return params;
    }
    case "smtp": {
      const d = (n.data || {}) as SmtpData;
      const params: Record<string, unknown> = {};
      if (d.from) params.from = String(d.from);
      if (d.to) params.to = emailStringToArray(d.to);
      if (d.cc) params.cc = emailStringToArray(d.cc);
      if (d.bcc) params.bcc = emailStringToArray(d.bcc);
      if (d.subject) params.subject = String(d.subject);
      if (d.body) params.body = String(d.body);
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
  scheduled: (base, params) => {
    const scheduledData: ScheduledData = {
      ...base,
      start_at: typeof params.start_at === "string" ? params.start_at : undefined,
      interval_seconds: 
        typeof params.interval_seconds === "number" 
          ? params.interval_seconds 
          : undefined,
      is_active: typeof params.is_active === "boolean" ? params.is_active : undefined,
    };
    return scheduledData;
  },
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
  switch: (base, params) => {
    const switchData: SwitchData = {
      ...base,
      rules: Array.isArray(params.rules)
        ? (params.rules as unknown[])
            .map((rule) => rule as Record<string, unknown>)
            .map((rule) => ({
              value:
                typeof rule.value === "string" ? rule.value : undefined,
              operator:
                typeof rule.operator === "string"
                  ? (rule.operator as SwitchRule["operator"])
                  : undefined,
              compare:
                typeof rule.compare === "string" ? rule.compare : undefined,
            }))
        : [],
    };
    return switchData;
  },
  smtp: (base, params) => {
    const smtpData: SmtpData = {
      ...base,
      from: typeof params.from === "string" ? params.from : undefined,
      to: emailArrayToString(params.to),
      cc: emailArrayToString(params.cc),
      bcc: emailArrayToString(params.bcc),
      subject:
        typeof params.subject === "string" ? params.subject : undefined,
      body: typeof params.body === "string" ? params.body : undefined,
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

// Convert Canvas graph to a workflow_data blueprint (stored in API)
export function canvasToWorkflowData(
  nodes: CanvasNode[],
  edges: RFEdge[],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const missingCredentials: Array<{ id: string; type: string }> = [];

  const blueprintNodes: WorkflowNode[] = nodes.map((n) => {
    const credential = extractNodeCredential(n);
    if (nodeTypeRequiresCredential(n.type) && !credential) {
      missingCredentials.push({ id: n.id, type: n.type });
    }

    return {
      id: n.id,
      name: nodeName(n),
      trigger: n.type === "trigger" || n.type === "scheduled",
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
          : n.type === "ScheduleTrigger"
            ? "scheduled"
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

    const switchHandleId = switchHandleIdFromLabel(e.label);
    const isTrueFalse = e.label === "true" || e.label === "false";
    if (isTrueFalse || switchHandleId) {
      const isTrue = e.label === "true";
      (edge as RFEdge & { sourceHandle?: string }).sourceHandle =
        switchHandleId || e.label;
      (edge as RFEdge & { labelStyle?: CSSProperties }).labelStyle = {
        fill: "white",
        fontWeight: 600,
      };
      (edge as RFEdge & { labelShowBg?: boolean }).labelShowBg = true;
      const bgFill = isTrue
        ? "hsl(142 70% 45%)"
        : e.label === "false"
          ? "hsl(0 70% 50%)"
          : switchHandleId === switchFallbackHandleId()
            ? "hsl(220 9% 55%)"
            : "hsl(211 80% 55%)";
      (edge as RFEdge & { labelBgStyle?: CSSProperties }).labelBgStyle = {
        fill: bgFill,
      };
      (edge as RFEdge & { labelBgPadding?: [number, number] }).labelBgPadding = [
        2,
        6,
      ];
      (edge as RFEdge & { labelBgBorderRadius?: number }).labelBgBorderRadius = 4;

      const readableLabel =
        switchHandleLabelFromId(switchHandleId || e.label) || e.label;
      (edge as RFEdge & { label?: string }).label = readableLabel;
    }

    return edge;
  });

  return { nodes, edges };
}

/**
 * Extract schedule information from workflow data.
 * 
 * @param workflowData The workflow_data object containing nodes and edges
 * @returns Schedule parameters if a ScheduleTrigger node exists, null otherwise
 */
export function getScheduleFromWorkflowData(
  workflowData: Record<string, unknown>
): { is_active: boolean; start_at?: string; interval_seconds?: number } | null {
  const nodes = workflowData.nodes as Array<Record<string, unknown>> | undefined;
  if (!nodes) return null;

  const scheduledNode = nodes.find(
    (n: Record<string, unknown>) => n.type === "ScheduleTrigger"
  ) as Record<string, unknown> | undefined;

  if (!scheduledNode) return null;

  const parameters = (scheduledNode.parameters || {}) as Record<string, unknown>;
  
  return {
    is_active: typeof parameters.is_active === "boolean" ? parameters.is_active : false,
    start_at: typeof parameters.start_at === "string" ? parameters.start_at : undefined,
    interval_seconds: typeof parameters.interval_seconds === "number" ? parameters.interval_seconds : undefined,
  };
}

/**
 * Update schedule parameters in workflow data.
 * Creates a new workflow_data object with updated schedule parameters.
 * 
 * @param workflowData The workflow_data object to update
 * @param scheduleUpdate The schedule parameters to update
 * @returns A new workflow_data object with updated schedule parameters
 */
export function updateScheduleInWorkflowData(
  workflowData: Record<string, unknown>,
  scheduleUpdate: {
    is_active?: boolean;
    start_at?: string;
    interval_seconds?: number;
  }
): Record<string, unknown> {
  const nodes = (workflowData.nodes as Array<Record<string, unknown>> | undefined) || [];
  
  const updatedNodes = nodes.map((n: Record<string, unknown>) => {
    if (n.type !== "ScheduleTrigger") return n;

    const parameters = (n.parameters || {}) as Record<string, unknown>;
    const updatedParameters = { ...parameters };

    if (scheduleUpdate.is_active !== undefined) {
      updatedParameters.is_active = scheduleUpdate.is_active;
    }
    if (scheduleUpdate.start_at !== undefined) {
      updatedParameters.start_at = scheduleUpdate.start_at;
    }
    if (scheduleUpdate.interval_seconds !== undefined) {
      updatedParameters.interval_seconds = scheduleUpdate.interval_seconds;
    }

    return {
      ...n,
      parameters: updatedParameters,
    };
  });

  return {
    ...workflowData,
    nodes: updatedNodes,
  };
}
