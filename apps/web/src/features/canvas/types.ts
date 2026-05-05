import type { Edge, Node } from "@xyflow/react";
import type { CredentialRef } from "@/lib/credentials";
import type { IntegrationNodeData, IntegrationNodeKind } from "./integrations/types";

/** The base data structure that all nodes share. */
export type BaseData = {
  label?: string;
  credential?: CredentialRef | null;
  /** When true, the node's position is preserved during auto-layout. */
  pinned?: boolean;
};

export type EditAssignment = {
  name?: string;
  value?: string;
  type?: "string" | "number" | "boolean" | "json";
};

export type LogLevel = "debug" | "info" | "warn" | "error";

export type DateTimeUnit = "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years";

export type FilterOperator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains";

export type FilterRule = {
  field?: string;
  operator?: FilterOperator;
  value?: string;
};

export type SortDirection = "asc" | "desc" | "ascending" | "descending";
export type SortValueType = "auto" | "text" | "number" | "date";

export type SortRule = {
  field?: string;
  direction?: SortDirection;
  type?: SortValueType;
};

/** Canonical list of HTTP methods for canvas + worker `http` node (includes PATCH). */
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export const AGENT_PROVIDERS = ["gemini", "openai", "anthropic"] as const;
export type AgentProvider = (typeof AGENT_PROVIDERS)[number];

export const GEMINI_BACKENDS = ["ai_studio", "vertex"] as const;
export type GeminiBackend = (typeof GEMINI_BACKENDS)[number];

export const AGENT_FIELD_TYPES = ["string", "number", "boolean", "object"] as const;
export type AgentFieldType = (typeof AGENT_FIELD_TYPES)[number];

export type AgentMessageRole = "user" | "model";

export type AgentMessage = {
  role: AgentMessageRole;
  content: string;
};

export type AgentModelConfig = {
  provider: AgentProvider;
  name: string;
  /** Gemini-only: which google.golang.org/genai backend to route through. */
  backend?: GeminiBackend;
  temperature?: number;
};

/** A tool field is either fixed or decided by the agent at call time. */
export type AgentFieldMode =
  | { mode: "fixed"; value?: unknown }
  | {
      mode: "agent";
      agent: { description: string; type: AgentFieldType; required: boolean };
    };

export type AgentKVField = { key: string; value: AgentFieldMode };

export type AgentHttpToolConfig = {
  method: HttpMethod;
  url: AgentFieldMode;
  headers?: AgentKVField[];
  query?: AgentKVField[];
  body?: AgentKVField[];
  timeout?: string;
  retry?: string;
  retry_delay?: string;
  raise_on_status?: string;
  ignore_ssl?: boolean;
};

export type AgentTool = {
  type: "http_request";
  name: string;
  description: string;
  /** Master resolves this into a `credentials` block (with values) before publishing. */
  credential?: CredentialRef | null;
  config: AgentHttpToolConfig;
};

export type AgentMcpTransport = "sse" | "streamable_http";

export type AgentMcpServer = {
  name: string;
  transport: AgentMcpTransport;
  url: string;
  credential?: CredentialRef | null;
};

export function isHttpMethod(value: string): value is HttpMethod {
  return (HTTP_METHODS as readonly string[]).includes(value);
}

/** A map defining the specific data for each kind of node. */
export type BuiltInNodeDataMap = {
  trigger: BaseData;

  scheduledTrigger: BaseData & {
    amount?: number;
    unit?: "seconds" | "minutes" | "hours" | "days";
  };

  agent: BaseData & {
    model?: AgentModelConfig;
    system_prompt?: string;
    messages?: AgentMessage[];
    tools?: AgentTool[];
    mcp_servers?: AgentMcpServer[];
  };

  if: BaseData & {
    expression?: string;
  };

  switch: BaseData & {
    rules?: SwitchRule[];
  };

  http: BaseData & {
    method?: HttpMethod;
    url?: string;
    headers?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
    /** Request timeout in seconds (serialized as string on the wire). */
    timeout?: number;
    /** Retry count after failure (stored as string in `workflow_data.parameters.retry`). */
    retry?: number;
    /** Delay between retries in seconds (`parameters.retry_delay`). */
    retry_delay?: number;
    /**
     * Comma-separated status patterns to treat as errors (e.g. `4xx,5xx`, `403`).
     * Omitted from saved `parameters` when empty.
     */
    raise_on_status?: string;
    /** Maps to `parameters.ignore_ssl`. */
    ignore_ssl?: boolean;
  };

  smtp: BaseData & {
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
  };

  wait: BaseData & {
    amount?: number;
    unit?: "seconds" | "minutes" | "hours" | "days";
  };

  log: BaseData & {
    message?: string;
    level?: LogLevel;
  };

  dateTimeNow: BaseData & {
    timezone?: string;
    format?: string;
  };

  dateTimeAdd: BaseData & {
    date?: string;
    amount?: number;
    unit?: DateTimeUnit;
    timezone?: string;
    format?: string;
  };

  dateTimeSubtract: BaseData & {
    date?: string;
    amount?: number;
    unit?: DateTimeUnit;
    timezone?: string;
    format?: string;
  };

  dateTimeFormat: BaseData & {
    date?: string;
    timezone?: string;
    format?: string;
  };

  dateTimeParse: BaseData & {
    date?: string;
    timezone?: string;
  };

  edit: BaseData & {
    mode?: "assignments" | "keep_only";
    assignments?: EditAssignment[];
  };

  filter: BaseData & {
    input_array?: string;
    match_mode?: "all" | "any";
    rules?: FilterRule[];
  };

  sort: BaseData & {
    input_array?: string;
    rules?: SortRule[];
  };

  limit: BaseData & {
    input_array?: string;
    count?: number | string;
  };

  split: BaseData & {
    array_field?: string;
  };

  aggregator: BaseData;

  merge: BaseData & {
    wait_mode?: "wait_for_all" | "wait_for_any";
    timeout?: number;
  };
};

export type IntegrationNodeDataMap = {
  [K in IntegrationNodeKind]: IntegrationNodeData;
};

export type NodeDataMap = BuiltInNodeDataMap & IntegrationNodeDataMap;

/** A union type of all possible node kinds. */
export type NodeKind = keyof NodeDataMap;

export type CanvasNode = {
  [K in NodeKind]: Node<NodeDataMap[K]> & { type: K };
}[NodeKind];

export type IfData = NodeDataMap["if"];
export type SwitchData = NodeDataMap["switch"];
export type HttpData = NodeDataMap["http"];
export type SmtpData = NodeDataMap["smtp"];
export type AgentData = NodeDataMap["agent"];
export type TriggerData = NodeDataMap["trigger"];
export type ScheduledTriggerData = NodeDataMap["scheduledTrigger"];
export type WaitData = NodeDataMap["wait"];
export type LogData = NodeDataMap["log"];
export type DateTimeNowData = NodeDataMap["dateTimeNow"];
export type DateTimeAddData = NodeDataMap["dateTimeAdd"];
export type DateTimeSubtractData = NodeDataMap["dateTimeSubtract"];
export type DateTimeFormatData = NodeDataMap["dateTimeFormat"];
export type DateTimeParseData = NodeDataMap["dateTimeParse"];
export type EditData = NodeDataMap["edit"];
export type FilterData = NodeDataMap["filter"];
export type SortData = NodeDataMap["sort"];
export type LimitData = NodeDataMap["limit"];
export type SplitData = NodeDataMap["split"];
export type AggregatorData = NodeDataMap["aggregator"];
export type MergeData = NodeDataMap["merge"];

export type CanvasEdge = Edge;

export type SwitchRule = {
  value?: string;
  operator?: SwitchOperator;
  compare?: string;
};

export type SwitchOperator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains";
