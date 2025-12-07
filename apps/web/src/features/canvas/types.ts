// ⚠️ GENERATED FILE - DO NOT EDIT MANUALLY
// This file is generated from dsl/dsl-definition.json
// To update, modify dsl/dsl-definition.json and run: make dsl-generate

import type { Edge, Node } from "@xyflow/react";
import type { CredentialRef } from "@/lib/credentials";

/** The base data structure that all nodes share. */
export type BaseData = {
  label?: string;
  credential?: CredentialRef | null;
  /** When true, the node's position is preserved during auto-layout. */
  pinned?: boolean;
};

/** A map defining the specific data for each kind of node. */
export type NodeDataMap = {
  trigger: BaseData;
  http: BaseData & {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url?: string;
    body?: unknown;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    retries?: number;
    retryDelay?: number;
    timeout?: number;
    raise_on_status?: string;
    ignoreSSL?: boolean;
  };
  smtp: BaseData & {
    subject?: string;
    body?: string;
    to?: string;
    from?: string;
    cc?: string;  // Frontend uses comma-separated string, converted to array in conversion functions
    bcc?: string;  // Frontend uses comma-separated string, converted to array in conversion functions
  };
  if: BaseData & {
    expression?: string;
    true_edge_id?: string;
    false_edge_id?: string;
  };
  switch: BaseData & {
    rules?: SwitchRule[];
    routes?: unknown[];
  };
  log: BaseData & {
    message?: string;
    level?: "debug" | "info" | "warn" | "error";
  };
  agent: BaseData & {
    prompt?: string;
  };
};

/** A union type of all possible node kinds. */
export type NodeKind = keyof NodeDataMap;

/** Node schema defining inputs and outputs for each node type. */
// TODO: MANUAL UPDATE REQUIRED - Update inputs/outputs when node types change
// This schema defines the inputs and outputs for each node type in the canvas.
// When adding new node types or changing node behavior, update this schema accordingly.
export const NODE_SCHEMA = {
  trigger: {
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
  log: {
    inputs: ["message"],
    outputs: ["logged"],
  },
} as const satisfies Record<NodeKind, { inputs: readonly string[]; outputs: readonly string[] }>;

export type CanvasNode = {
  [K in NodeKind]: Node<NodeDataMap[K]> & { type: K };
}[NodeKind];

export type TriggerData = NodeDataMap["trigger"];
export type HttpData = NodeDataMap["http"];
export type SmtpData = NodeDataMap["smtp"];
export type IfData = NodeDataMap["if"];
export type SwitchData = NodeDataMap["switch"];
export type LogData = NodeDataMap["log"];
export type AgentData = NodeDataMap["agent"];

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