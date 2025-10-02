import type { Edge, Node } from "@xyflow/react";

export type NodeKind = "trigger" | "agent" | "if" | "http" | "smtp";

export type BaseData = { label?: string };
export type TriggerData = BaseData;
export type AgentData = BaseData;
export type IfData = BaseData & { expression?: string };
export type HttpData = BaseData & {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  ignoreSSL?: boolean;
};
export type SmtpData = BaseData & { to?: string; subject?: string };

export type NodeDataMap = {
  trigger: TriggerData;
  agent: AgentData;
  if: IfData;
  http: HttpData;
  smtp: SmtpData;
};

export type CanvasNodeByKind = {
  trigger: Node<TriggerData> & { type: "trigger"; data: TriggerData };
  agent: Node<AgentData> & { type: "agent"; data: AgentData };
  if: Node<IfData> & { type: "if"; data: IfData };
  http: Node<HttpData> & { type: "http"; data: HttpData };
  smtp: Node<SmtpData> & { type: "smtp"; data: SmtpData };
};

export type CanvasNode = CanvasNodeByKind[keyof CanvasNodeByKind];

export type CanvasEdge = Edge;
