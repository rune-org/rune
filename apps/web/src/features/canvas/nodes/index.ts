import type { NodeTypes } from "@xyflow/react";
import { AgentNode } from "./AgentNode";
import { TriggerNode } from "./TriggerNode";
import { IfNode } from "./IfNode";
import { SwitchNode } from "./SwitchNode";
import { HttpNode } from "./HttpNode";
import { SmtpNode } from "./SmtpNode";
import { WaitNode } from "./WaitNode";
import { EditNode } from "./EditNode";
import { SplitNode } from "./SplitNode";
import { AggregatorNode } from "./AggregatorNode";
import { MergeNode } from "./MergeNode";
import { ScheduledNode } from "./ScheduledNode";

export const nodeTypes: NodeTypes = {
  agent: AgentNode,
  trigger: TriggerNode,
  scheduled: ScheduledNode,
  if: IfNode,
  switch: SwitchNode,
  http: HttpNode,
  smtp: SmtpNode,
  wait: WaitNode,
  edit: EditNode,
  split: SplitNode,
  aggregator: AggregatorNode,
  merge: MergeNode,
};
