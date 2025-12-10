import type { NodeTypes } from "@xyflow/react";
import { AgentNode } from "./AgentNode";
import { TriggerNode } from "./TriggerNode";
import { ScheduledNode } from "./ScheduledNode";
import { IfNode } from "./IfNode";
import { SwitchNode } from "./SwitchNode";
import { HttpNode } from "./HttpNode";
import { SmtpNode } from "./SmtpNode";

export const nodeTypes: NodeTypes = {
  agent: AgentNode,
  trigger: TriggerNode,
  scheduled: ScheduledNode,
  if: IfNode,
  switch: SwitchNode,
  http: HttpNode,
  smtp: SmtpNode,
};
