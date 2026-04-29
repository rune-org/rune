// Types and helpers for the frontend representation of the Workflow DSL

import type { Edge as RFEdge } from "@xyflow/react";
import type { CSSProperties } from "react";
import {
  isHttpMethod,
  type CanvasNode,
  type HttpData,
  type IfData,
  type SwitchData,
  type SwitchRule,
  type SmtpData,
  type ScheduledTriggerData,
  type WaitData,
  type LogData,
  type DateTimeNowData,
  type DateTimeAddData,
  type DateTimeSubtractData,
  type DateTimeFormatData,
  type DateTimeParseData,
  type EditData,
  type FilterData,
  type FilterRule,
  type SortData,
  type SortRule,
  type LimitData,
  type SplitData,
  type AggregatorData,
  type MergeData,
  type AgentData,
} from "@/features/canvas/types";
import { isCredentialRef, nodeTypeRequiresCredential } from "@/lib/credentials";
import type { CredentialRef } from "@/lib/credentials";
import {
  switchFallbackHandleId,
  switchHandleIdFromLabel,
  switchHandleLabelFromId,
  switchRuleHandleId,
} from "@/features/canvas/utils/switchHandles";
import { sanitizeNodeLabel } from "@/features/canvas/utils/nodeLabels";

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
  constructor(public readonly nodes: Array<{ id: string; type: string }>) {
    super(`Missing credentials for nodes: ${nodes.map((n) => `${n.type} (${n.id})`).join(", ")}`);
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
    case "scheduledTrigger":
      return "ScheduledTrigger";
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
    case "wait":
      return "wait";
    case "log":
      return "log";
    case "dateTimeNow":
      return "dateTimeNow";
    case "dateTimeAdd":
      return "dateTimeAdd";
    case "dateTimeSubtract":
      return "dateTimeSubtract";
    case "dateTimeFormat":
      return "dateTimeFormat";
    case "dateTimeParse":
      return "dateTimeParse";
    case "edit":
      return "edit";
    case "filter":
      return "filter";
    case "sort":
      return "sort";
    case "limit":
      return "limit";
    case "split":
      return "split";
    case "aggregator":
      return "aggregator";
    case "merge":
      return "merge";
    default:
      return canvasType;
  }
}

// Human-friendly node naming
function nodeName(n: CanvasNode): string {
  const base = (n.data as { label?: string }).label;
  if (base && base.trim()) return sanitizeNodeLabel(base.trim(), "Node");
  return n.type.charAt(0).toUpperCase() + n.type.slice(1);
}

// Helper to convert comma-separated email string to array
function emailStringToArray(value: string | undefined): string[] | string | undefined {
  if (isLegacySmtpPlaceholder(value)) return undefined;
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

export const LEGACY_SMTP_PLACEHOLDER_VALUES = new Set([
  "sender@example.com",
  "recipient@example.com",
  "cc@example.com",
  "bcc@example.com",
  "Email subject line",
  "Email message body",
]);

export function isLegacySmtpPlaceholder(value: unknown): boolean {
  return typeof value === "string" && LEGACY_SMTP_PLACEHOLDER_VALUES.has(value.trim());
}

// Build parameter objects for supported node types
function toWorkerParameters(n: CanvasNode, edges: RFEdge[]): Record<string, unknown> {
  switch (n.type) {
    case "http": {
      /** Pre–snake_case canvas fields (still serialize if present). */
      type LegacyHttpCanvas = {
        retries?: number;
        retryDelay?: number;
        raiseOnStatus?: string;
        ignoreSSL?: boolean;
      };
      const d = (n.data || {}) as HttpData & LegacyHttpCanvas;
      const params: Record<string, unknown> = {};
      if (d.method) params.method = String(d.method).toUpperCase();
      if (d.url) params.url = String(d.url);
      if (d.headers && typeof d.headers === "object") params.headers = d.headers;
      if (d.query && typeof d.query === "object") params.query = d.query;
      if (typeof d.body !== "undefined") params.body = d.body as unknown;
      if (typeof d.timeout !== "undefined") params.timeout = String(d.timeout);
      const retryCount =
        typeof d.retry === "number" && !Number.isNaN(d.retry)
          ? d.retry
          : typeof d.retries === "number" && !Number.isNaN(d.retries)
            ? d.retries
            : undefined;
      if (typeof retryCount !== "undefined") params.retry = String(retryCount);
      const delay =
        typeof d.retry_delay === "number" && !Number.isNaN(d.retry_delay)
          ? d.retry_delay
          : typeof d.retryDelay === "number" && !Number.isNaN(d.retryDelay)
            ? d.retryDelay
            : undefined;
      if (typeof delay !== "undefined") params.retry_delay = String(delay);
      const raise =
        typeof d.raise_on_status === "string" && d.raise_on_status.trim()
          ? d.raise_on_status.trim()
          : typeof d.raiseOnStatus === "string" && d.raiseOnStatus.trim()
            ? d.raiseOnStatus.trim()
            : undefined;
      if (raise) params.raise_on_status = raise;
      const ignoreSsl =
        typeof d.ignore_ssl === "boolean"
          ? d.ignore_ssl
          : typeof d.ignoreSSL === "boolean"
            ? d.ignoreSSL
            : undefined;
      if (typeof ignoreSsl !== "undefined") params.ignore_ssl = ignoreSsl;
      return params;
    }
    case "if": {
      // Map labeled handles to true/false edge IDs
      const outgoing = edges.filter((e) => e.source === n.id);
      const trueEdge = outgoing.find(
        (e) => (e as RFEdge & { sourceHandle?: string }).sourceHandle === "true",
      );
      const falseEdge = outgoing.find(
        (e) => (e as RFEdge & { sourceHandle?: string }).sourceHandle === "false",
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
                typeof rule.value === "string" && rule.value.trim() ? rule.value.trim() : undefined,
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
          (e) => (e as RFEdge & { sourceHandle?: string }).sourceHandle === switchRuleHandleId(idx),
        );
        if (edge) routes[idx] = edge.id;
      });
      const fallbackEdge = outgoing.find(
        (e) => (e as RFEdge & { sourceHandle?: string }).sourceHandle === switchFallbackHandleId(),
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
      if (d.from && !isLegacySmtpPlaceholder(d.from)) params.from = String(d.from);
      if (d.to) params.to = emailStringToArray(d.to);
      if (d.cc) params.cc = emailStringToArray(d.cc);
      if (d.bcc) params.bcc = emailStringToArray(d.bcc);
      if (d.subject && !isLegacySmtpPlaceholder(d.subject)) params.subject = String(d.subject);
      if (d.body && !isLegacySmtpPlaceholder(d.body)) params.body = String(d.body);
      return params;
    }
    case "wait": {
      const d = (n.data || {}) as WaitData;
      const params: Record<string, unknown> = {};
      if (typeof d.amount !== "undefined") params.amount = Number(d.amount);
      if (d.unit) params.unit = String(d.unit);
      return params;
    }
    case "log": {
      const d = (n.data || {}) as LogData;
      const params: Record<string, unknown> = {};
      if (typeof d.message === "string") params.message = d.message;
      if (d.level) params.level = d.level;
      return params;
    }
    case "dateTimeNow": {
      const d = (n.data || {}) as DateTimeNowData;
      const params: Record<string, unknown> = {};
      if (typeof d.format === "string" && d.format.trim()) params.format = d.format;
      if (typeof d.timezone === "string" && d.timezone.trim()) params.timezone = d.timezone;
      return params;
    }
    case "dateTimeAdd": {
      const d = (n.data || {}) as DateTimeAddData;
      const params: Record<string, unknown> = {};
      if (typeof d.date === "string" && d.date.trim()) params.date = d.date;
      if (typeof d.amount !== "undefined") params.amount = Number(d.amount);
      if (d.unit) params.unit = d.unit;
      if (typeof d.format === "string" && d.format.trim()) params.format = d.format;
      if (typeof d.timezone === "string" && d.timezone.trim()) params.timezone = d.timezone;
      return params;
    }
    case "dateTimeSubtract": {
      const d = (n.data || {}) as DateTimeSubtractData;
      const params: Record<string, unknown> = {};
      if (typeof d.date === "string" && d.date.trim()) params.date = d.date;
      if (typeof d.amount !== "undefined") params.amount = Number(d.amount);
      if (d.unit) params.unit = d.unit;
      if (typeof d.format === "string" && d.format.trim()) params.format = d.format;
      if (typeof d.timezone === "string" && d.timezone.trim()) params.timezone = d.timezone;
      return params;
    }
    case "dateTimeFormat": {
      const d = (n.data || {}) as DateTimeFormatData;
      const params: Record<string, unknown> = {};
      if (typeof d.date === "string" && d.date.trim()) params.date = d.date;
      if (typeof d.format === "string" && d.format.trim()) params.format = d.format;
      if (typeof d.timezone === "string" && d.timezone.trim()) params.timezone = d.timezone;
      return params;
    }
    case "dateTimeParse": {
      const d = (n.data || {}) as DateTimeParseData;
      const params: Record<string, unknown> = {};
      if (typeof d.date === "string" && d.date.trim()) params.date = d.date;
      if (typeof d.timezone === "string" && d.timezone.trim()) params.timezone = d.timezone;
      return params;
    }
    case "scheduledTrigger": {
      const d = (n.data || {}) as ScheduledTriggerData;
      const params: Record<string, unknown> = {};
      if (typeof d.amount !== "undefined") params.amount = Number(d.amount);
      if (typeof d.unit === "string") params.unit = d.unit;
      return params;
    }
    case "edit": {
      const d = (n.data || {}) as EditData;
      const params: Record<string, unknown> = {};
      if (d.mode) params.mode = String(d.mode);
      if (Array.isArray(d.assignments) && d.assignments.length > 0) {
        params.assignments = d.assignments.map((a) => ({
          name: a.name || "",
          value: a.value || "",
          type: a.type || "string",
        }));
      }
      return params;
    }
    case "filter": {
      const d = (n.data || {}) as FilterData;
      const params: Record<string, unknown> = {};
      if (typeof d.input_array === "string" && d.input_array.trim())
        params.input_array = d.input_array.trim();
      if (d.match_mode) params.match_mode = d.match_mode;
      if (Array.isArray(d.rules) && d.rules.length > 0) {
        params.rules = d.rules.map((rule) => ({
          field: rule.field || "",
          operator: rule.operator || "==",
          value: rule.value || "",
        }));
      }
      return params;
    }
    case "sort": {
      const d = (n.data || {}) as SortData;
      const params: Record<string, unknown> = {};
      if (typeof d.input_array === "string" && d.input_array.trim())
        params.input_array = d.input_array.trim();
      if (Array.isArray(d.rules) && d.rules.length > 0) {
        params.rules = d.rules.map((rule) => ({
          field: rule.field || "",
          direction: rule.direction || "asc",
          type: rule.type || "auto",
        }));
      }
      return params;
    }
    case "limit": {
      const d = (n.data || {}) as LimitData;
      const params: Record<string, unknown> = {};
      if (typeof d.input_array === "string" && d.input_array.trim())
        params.input_array = d.input_array.trim();
      if (typeof d.count !== "undefined" && d.count !== "") params.count = Number(d.count);
      return params;
    }
    case "split": {
      const d = (n.data || {}) as SplitData;
      const params: Record<string, unknown> = {};
      // Worker expects 'input_array' parameter
      if (d.array_field) params.input_array = String(d.array_field);
      return params;
    }
    case "aggregator": {
      // Aggregator has no configurable parameters
      return {};
    }
    case "merge": {
      const d = (n.data || {}) as MergeData;
      const params: Record<string, unknown> = {};
      if (d.wait_mode) params.wait_mode = String(d.wait_mode);
      if (typeof d.timeout !== "undefined") params.timeout = Number(d.timeout);
      return params;
    }
    case "agent": {
      const d = (n.data || {}) as AgentData;
      const params: Record<string, unknown> = {};
      if (d.model) params.model = d.model;
      if (typeof d.system_prompt === "string" && d.system_prompt.length > 0) {
        params.system_prompt = d.system_prompt;
      }
      if (Array.isArray(d.messages) && d.messages.length > 0) params.messages = d.messages;
      if (Array.isArray(d.tools) && d.tools.length > 0) params.tools = d.tools;
      if (Array.isArray(d.mcp_servers) && d.mcp_servers.length > 0) {
        params.mcp_servers = d.mcp_servers;
      }
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

const identityNodeHydrator: NodeHydrator = (base) => base;

const nodeHydrators: Partial<Record<CanvasNode["type"], NodeHydrator>> = {
  http: (base, params) => {
    type LegacyCanvas = {
      retries?: unknown;
      raiseOnStatus?: unknown;
      retryDelay?: unknown;
      ignoreSSL?: unknown;
    };
    const {
      retries: _legacyRetries,
      raiseOnStatus: _legacyRaiseCamel,
      retryDelay: _legacyDelayCamel,
      ignoreSSL: _legacyIgnoreCamel,
      ...restBase
    } = base as HttpData & LegacyCanvas;

    const methodUpper = typeof params.method === "string" ? params.method.toUpperCase() : "";
    const methodFromWire = isHttpMethod(methodUpper) ? methodUpper : undefined;

    const retryFromParams =
      typeof params.retry === "number"
        ? params.retry
        : typeof params.retry === "string"
          ? Number(params.retry)
          : undefined;
    const retryFromLegacy =
      typeof _legacyRetries === "number"
        ? _legacyRetries
        : typeof _legacyRetries === "string"
          ? Number(_legacyRetries)
          : undefined;
    const retryNum = Number.isFinite(retryFromParams)
      ? retryFromParams
      : Number.isFinite(retryFromLegacy)
        ? retryFromLegacy
        : undefined;

    const delayFromParams =
      typeof params.retry_delay === "number"
        ? params.retry_delay
        : typeof params.retry_delay === "string"
          ? Number(params.retry_delay)
          : undefined;
    const delayFromLegacyCamel =
      typeof _legacyDelayCamel === "number"
        ? _legacyDelayCamel
        : typeof _legacyDelayCamel === "string"
          ? Number(_legacyDelayCamel)
          : undefined;
    const delayNum = Number.isFinite(delayFromParams)
      ? delayFromParams
      : Number.isFinite(delayFromLegacyCamel)
        ? delayFromLegacyCamel
        : undefined;

    const raiseFromParams =
      typeof params.raise_on_status === "string" ? params.raise_on_status.trim() : "";
    const raiseFromLegacyCamel =
      typeof _legacyRaiseCamel === "string" ? String(_legacyRaiseCamel).trim() : "";
    const raise_on_status = raiseFromParams || raiseFromLegacyCamel || undefined;

    const ignoreFromParams = typeof params.ignore_ssl === "boolean" ? params.ignore_ssl : undefined;
    const ignoreFromLegacyCamel =
      typeof _legacyIgnoreCamel === "boolean" ? _legacyIgnoreCamel : undefined;
    const ignore_ssl =
      typeof ignoreFromParams === "boolean"
        ? ignoreFromParams
        : typeof ignoreFromLegacyCamel === "boolean"
          ? ignoreFromLegacyCamel
          : undefined;

    const httpData: HttpData = {
      ...restBase,
      method: methodFromWire,
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
      retry: Number.isFinite(retryNum) ? retryNum : undefined,
      retry_delay: Number.isFinite(delayNum) ? delayNum : undefined,
      raise_on_status: raise_on_status || undefined,
      ignore_ssl,
    };
    return httpData;
  },
  if: (base, params) => {
    const ifData: IfData = {
      ...base,
      expression: typeof params.expression === "string" ? params.expression : undefined,
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
              value: typeof rule.value === "string" ? rule.value : undefined,
              operator:
                typeof rule.operator === "string"
                  ? (rule.operator as SwitchRule["operator"])
                  : undefined,
              compare: typeof rule.compare === "string" ? rule.compare : undefined,
            }))
        : [],
    };
    return switchData;
  },
  agent: (base, params) => {
    const agentData: AgentData = {
      ...base,
      model: (params.model as AgentData["model"]) ?? undefined,
      system_prompt: typeof params.system_prompt === "string" ? params.system_prompt : undefined,
      messages: Array.isArray(params.messages)
        ? (params.messages as AgentData["messages"])
        : undefined,
      tools: Array.isArray(params.tools) ? (params.tools as AgentData["tools"]) : undefined,
      mcp_servers: Array.isArray(params.mcp_servers)
        ? (params.mcp_servers as AgentData["mcp_servers"])
        : undefined,
    };
    return agentData;
  },
  smtp: (base, params) => {
    const smtpData: SmtpData = {
      ...base,
      from: typeof params.from === "string" ? params.from : undefined,
      to: emailArrayToString(params.to),
      cc: emailArrayToString(params.cc),
      bcc: emailArrayToString(params.bcc),
      subject: typeof params.subject === "string" ? params.subject : undefined,
      body: typeof params.body === "string" ? params.body : undefined,
    };
    return smtpData;
  },
  wait: (base, params) => {
    const waitData: WaitData = {
      ...base,
      amount:
        typeof params.amount === "number"
          ? params.amount
          : typeof params.amount === "string"
            ? Number(params.amount)
            : undefined,
      unit: typeof params.unit === "string" ? (params.unit as WaitData["unit"]) : undefined,
    };
    return waitData;
  },
  log: (base, params) => {
    const logData: LogData = {
      ...base,
      message: typeof params.message === "string" ? params.message : undefined,
      level: typeof params.level === "string" ? (params.level as LogData["level"]) : undefined,
    };
    return logData;
  },
  dateTimeNow: (base, params) => {
    const data: DateTimeNowData = {
      ...base,
      format: typeof params.format === "string" ? params.format : undefined,
      timezone: typeof params.timezone === "string" ? params.timezone : undefined,
    };
    return data;
  },
  dateTimeAdd: (base, params) => {
    const data: DateTimeAddData = {
      ...base,
      date: typeof params.date === "string" ? params.date : undefined,
      amount:
        typeof params.amount === "number"
          ? params.amount
          : typeof params.amount === "string"
            ? Number(params.amount)
            : undefined,
      unit: typeof params.unit === "string" ? (params.unit as DateTimeAddData["unit"]) : undefined,
      format: typeof params.format === "string" ? params.format : undefined,
      timezone: typeof params.timezone === "string" ? params.timezone : undefined,
    };
    return data;
  },
  dateTimeSubtract: (base, params) => {
    const data: DateTimeSubtractData = {
      ...base,
      date: typeof params.date === "string" ? params.date : undefined,
      amount:
        typeof params.amount === "number"
          ? params.amount
          : typeof params.amount === "string"
            ? Number(params.amount)
            : undefined,
      unit:
        typeof params.unit === "string" ? (params.unit as DateTimeSubtractData["unit"]) : undefined,
      format: typeof params.format === "string" ? params.format : undefined,
      timezone: typeof params.timezone === "string" ? params.timezone : undefined,
    };
    return data;
  },
  dateTimeFormat: (base, params) => {
    const data: DateTimeFormatData = {
      ...base,
      date: typeof params.date === "string" ? params.date : undefined,
      format: typeof params.format === "string" ? params.format : undefined,
      timezone: typeof params.timezone === "string" ? params.timezone : undefined,
    };
    return data;
  },
  dateTimeParse: (base, params) => {
    const data: DateTimeParseData = {
      ...base,
      date: typeof params.date === "string" ? params.date : undefined,
      timezone: typeof params.timezone === "string" ? params.timezone : undefined,
    };
    return data;
  },
  scheduledTrigger: (base, params) => {
    const scheduledTriggerData: ScheduledTriggerData = {
      ...base,
      amount:
        typeof params.amount === "number"
          ? params.amount
          : typeof params.amount === "string"
            ? Number(params.amount)
            : undefined,
      unit:
        typeof params.unit === "string" ? (params.unit as ScheduledTriggerData["unit"]) : undefined,
    };
    return scheduledTriggerData;
  },
  edit: (base, params) => {
    const editData: EditData = {
      ...base,
      mode: typeof params.mode === "string" ? (params.mode as EditData["mode"]) : undefined,
      assignments: Array.isArray(params.assignments)
        ? (params.assignments as unknown[]).map((a) => {
            const assignment = a as Record<string, unknown>;
            return {
              name: typeof assignment.name === "string" ? assignment.name : undefined,
              value: typeof assignment.value === "string" ? assignment.value : undefined,
              type:
                typeof assignment.type === "string"
                  ? (assignment.type as "string" | "number" | "boolean" | "json")
                  : undefined,
            };
          })
        : [],
    };
    return editData;
  },
  filter: (base, params) => {
    const filterData: FilterData = {
      ...base,
      input_array: typeof params.input_array === "string" ? params.input_array : undefined,
      match_mode:
        typeof params.match_mode === "string"
          ? (params.match_mode as FilterData["match_mode"])
          : undefined,
      rules: Array.isArray(params.rules)
        ? (params.rules as unknown[])
            .map((rule) => rule as Record<string, unknown>)
            .map((rule) => ({
              field: typeof rule.field === "string" ? rule.field : undefined,
              operator:
                typeof rule.operator === "string"
                  ? (rule.operator as FilterRule["operator"])
                  : undefined,
              value:
                typeof rule.value === "string"
                  ? rule.value
                  : rule.value != null
                    ? String(rule.value)
                    : undefined,
            }))
        : [],
    };
    return filterData;
  },
  sort: (base, params) => {
    const sortData: SortData = {
      ...base,
      input_array: typeof params.input_array === "string" ? params.input_array : undefined,
      rules: Array.isArray(params.rules)
        ? (params.rules as unknown[])
            .map((rule) => rule as Record<string, unknown>)
            .map((rule) => ({
              field: typeof rule.field === "string" ? rule.field : undefined,
              direction:
                typeof rule.direction === "string"
                  ? (rule.direction as SortRule["direction"])
                  : undefined,
              type: typeof rule.type === "string" ? (rule.type as SortRule["type"]) : undefined,
            }))
        : [],
    };
    return sortData;
  },
  limit: (base, params) => {
    const limitData: LimitData = {
      ...base,
      input_array: typeof params.input_array === "string" ? params.input_array : undefined,
      count:
        typeof params.count === "number"
          ? params.count
          : typeof params.count === "string"
            ? params.count
            : undefined,
    };
    return limitData;
  },
  split: (base, params) => {
    const splitData: SplitData = {
      ...base,
      array_field:
        typeof params.input_array === "string"
          ? params.input_array
          : typeof params.array_field === "string"
            ? params.array_field
            : undefined,
    };
    return splitData;
  },
  aggregator: (base) => {
    const aggregatorData: AggregatorData = {
      ...base,
    };
    return aggregatorData;
  },
  merge: (base, params) => {
    const mergeData: MergeData = {
      ...base,
      wait_mode:
        typeof params.wait_mode === "string"
          ? (params.wait_mode as MergeData["wait_mode"])
          : undefined,
      timeout:
        typeof params.timeout === "number"
          ? params.timeout
          : typeof params.timeout === "string"
            ? Number(params.timeout)
            : undefined,
    };
    return mergeData;
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
      trigger: n.type === "trigger" || n.type === "scheduledTrigger",
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
export function workflowDataToCanvas(data: { nodes?: WorkflowNode[]; edges?: WorkflowEdge[] }): {
  nodes: CanvasNode[];
  edges: RFEdge[];
} {
  const nodes: CanvasNode[] = (data.nodes ?? []).map((n) => {
    const [x, y] = (n.position ?? [100, 100]) as [number, number];
    // Map canonical type back to canvas palette names
    const canvasType =
      n.type === "conditional"
        ? "if"
        : n.type === "ManualTrigger"
          ? "trigger"
          : n.type === "ScheduledTrigger"
            ? "scheduledTrigger"
            : n.type;
    const credentials = n.credentials ? { ...n.credentials } : undefined;
    const baseData = {
      label: sanitizeNodeLabel(n.name, "Node"),
      ...(credentials ? { credential: credentials } : {}),
    } as CanvasNode["data"];
    const params = (n.parameters ?? {}) as Record<string, unknown>;
    const hydrateDataForNode = Object.hasOwn(nodeHydrators, canvasType)
      ? (nodeHydrators[canvasType as CanvasNode["type"]] ?? identityNodeHydrator)
      : identityNodeHydrator;
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
      (edge as RFEdge & { sourceHandle?: string }).sourceHandle = switchHandleId || e.label;
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
      (edge as RFEdge & { labelBgPadding?: [number, number] }).labelBgPadding = [2, 6];
      (edge as RFEdge & { labelBgBorderRadius?: number }).labelBgBorderRadius = 4;

      const readableLabel = switchHandleLabelFromId(switchHandleId || e.label) || e.label;
      (edge as RFEdge & { label?: string }).label = readableLabel;
    }

    return edge;
  });

  return { nodes, edges };
}

// ————————————————————————————————————————————————————————————————
// Sanitizer for API/DSL workflow_data (export: strip credential refs)
// ————————————————————————————————————————————————————————————————

/**
 * Strips credential references from workflow_data nodes for safe export.
 * Returns nodes and edges at top level; does not convert DSL to canvas shape.
 */
export function stripCredentialsFromWorkflowData(workflowData: {
  nodes?: Array<Record<string, unknown>>;
  edges?: unknown[];
}): { nodes: Array<Record<string, unknown>>; edges: unknown[] } {
  const edges = workflowData.edges ?? [];
  const nodes = workflowData.nodes;
  if (!nodes || !Array.isArray(nodes)) {
    return { nodes: [], edges };
  }
  const sanitizedNodes = nodes.map((node) => {
    const { credentials: _omit, ...rest } = node;
    return rest;
  });
  return { nodes: sanitizedNodes, edges };
}
