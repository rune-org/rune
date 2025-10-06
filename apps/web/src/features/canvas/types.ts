import type { Edge, Node } from "@xyflow/react";

/** The base data structure that all nodes share. */
export type BaseData = {
  label?: string;
};

/** A map defining the specific data for each kind of node. */
export type NodeDataMap = {
  trigger: BaseData;

  agent: BaseData;

  if: BaseData & {
    expression?: string;
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
    to?: string;
    subject?: string;
  };
};

/** A union type of all possible node kinds. */
export type NodeKind = keyof NodeDataMap;

export type CanvasNode = {
  [K in NodeKind]: Node<NodeDataMap[K]> & { type: K };
}[NodeKind];

export type IfData = NodeDataMap["if"];
export type HttpData = NodeDataMap["http"];
export type SmtpData = NodeDataMap["smtp"];
export type AgentData = NodeDataMap["agent"];
export type TriggerData = NodeDataMap["trigger"];

export type CanvasEdge = Edge;
