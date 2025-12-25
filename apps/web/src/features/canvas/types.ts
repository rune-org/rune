import type { Edge, Node } from "@xyflow/react";
import type { CredentialRef } from "@/lib/credentials";

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

/** A map defining the specific data for each kind of node. */
export type NodeDataMap = {
  trigger: BaseData;

  scheduled: BaseData & {
    start_at?: string; // ISO 8601 datetime string
    interval_seconds?: number; // Run every N seconds
    is_active?: boolean; // Whether the schedule is active
  };

  agent: BaseData;

  if: BaseData & {
    expression?: string;
  };

  switch: BaseData & {
    rules?: SwitchRule[];
  };

  http: BaseData & {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    url?: string;
    headers?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
    timeout?: number;
    retries?: number;
    ignoreSSL?: boolean;
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

  edit: BaseData & {
    mode?: "assignments" | "keep_only";
    assignments?: EditAssignment[];
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

/** A union type of all possible node kinds. */
export type NodeKind = keyof NodeDataMap;

/** Node schema defining inputs and outputs for each node type. */
export const NODE_SCHEMA = {
  trigger: {
    inputs: [],
    outputs: ["trigger"],
  },
  scheduled: {
    inputs: [],
    outputs: ["trigger"],
  },
  agent: {
    inputs: ["input"],
    outputs: ["response"],
  },
  if: {
    inputs: ["condition"],
    outputs: ["true", "false"],
  },
  switch: {
    inputs: ["input"],
    outputs: [], // dynamic based on configured rules
  },
  http: {
    inputs: ["request"],
    outputs: ["response", "error"],
  },
  smtp: {
    inputs: ["email"],
    outputs: ["sent", "error"],
  },
  wait: {
    inputs: ["input"],
    outputs: ["resume"],
  },
  edit: {
    inputs: ["input"],
    outputs: ["output"],
  },
  split: {
    inputs: ["input"],
    outputs: ["item"],
  },
  aggregator: {
    inputs: ["items"],
    outputs: ["aggregated"],
  },
  merge: {
    inputs: ["branches"],
    outputs: ["merged"],
  },
} as const satisfies Record<NodeKind, { inputs: readonly string[]; outputs: readonly string[] }>;

export type CanvasNode = {
  [K in NodeKind]: Node<NodeDataMap[K]> & { type: K };
}[NodeKind];

export type IfData = NodeDataMap["if"];
export type SwitchData = NodeDataMap["switch"];
export type HttpData = NodeDataMap["http"];
export type SmtpData = NodeDataMap["smtp"];
export type AgentData = NodeDataMap["agent"];
export type TriggerData = NodeDataMap["trigger"];
export type ScheduledData = NodeDataMap["scheduled"];
export type WaitData = NodeDataMap["wait"];
export type EditData = NodeDataMap["edit"];
export type SplitData = NodeDataMap["split"];
export type AggregatorData = NodeDataMap["aggregator"];
export type MergeData = NodeDataMap["merge"];

export type CanvasEdge = Edge;

export type SwitchRule = {
  value?: string;
  operator?: SwitchOperator;
  compare?: string;
};

export type SwitchOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "contains";