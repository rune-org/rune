import type { NodeTypes } from "@xyflow/react";
import { AgentNode } from "./AgentNode";
import { TriggerNode } from "./TriggerNode";
import { IfNode } from "./IfNode";
import { HttpNode } from "./HttpNode";
import { SmtpNode } from "./SmtpNode";

export const nodeTypes: NodeTypes = {
  agent: AgentNode,
  trigger: TriggerNode,
  if: IfNode,
  http: HttpNode,
  smtp: SmtpNode,
};
