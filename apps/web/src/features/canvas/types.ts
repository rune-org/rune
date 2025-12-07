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
    method?: string;
    url?: string;
    body?: unknown;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    retries?: string;
    retryDelay?: string;
    timeout?: string;
    raise_on_status?: string;
    ignoreSSL?: boolean;
  };
  smtp: BaseData & {
    subject?: string;
    body?: string;
    to?: string;
    from?: string;
    cc?: unknown[];
    bcc?: unknown[];
  };
  if: BaseData & {
    expression?: string;
    true_edge_id?: string;
    false_edge_id?: string;
  };
  switch: BaseData & {
    rules?: unknown[];
    routes?: unknown[];
  };
  log: BaseData & {
    message?: string;
    level?: string;
  };
  agent: BaseData & {
    prompt?: string;
  };
};

/** A union type of all possible node kinds. */
export type NodeKind = keyof NodeDataMap;

/** Node schema defining inputs and outputs for each node type. */
// TODO: Update inputs/outputs based on node type requirements from DSL
export const NODE_SCHEMA = {
  trigger: {
    inputs: [], // TODO: Define based on node type
    outputs: [], // TODO: Define based on node type
  },
  http: {
    inputs: [], // TODO: Define based on node type
    outputs: [], // TODO: Define based on node type
  },
  smtp: {
    inputs: [], // TODO: Define based on node type
    outputs: [], // TODO: Define based on node type
  },
  if: {
    inputs: [], // TODO: Define based on node type
    outputs: [], // TODO: Define based on node type
  },
  switch: {
    inputs: [], // TODO: Define based on node type
    outputs: [], // TODO: Define based on node type
  },
  log: {
    inputs: [], // TODO: Define based on node type
    outputs: [], // TODO: Define based on node type
  },
  agent: {
    inputs: [], // TODO: Define based on node type
    outputs: [], // TODO: Define based on node type
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
