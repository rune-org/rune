import type { NodeTypes } from "@xyflow/react";
import { AgentNode } from "./AgentNode";
import { TriggerNode } from "./TriggerNode";
import { ScheduledTriggerNode } from "./ScheduledTriggerNode";
import { IfNode } from "./IfNode";
import { SwitchNode } from "./SwitchNode";
import { HttpNode } from "./HttpNode";
import { SmtpNode } from "./SmtpNode";
import { WaitNode } from "./WaitNode";
import { LogNode } from "./LogNode";
import { DateTimeNode } from "./DateTimeNode";
import { EditNode } from "./EditNode";
import { FilterNode } from "./FilterNode";
import { SortNode } from "./SortNode";
import { LimitNode } from "./LimitNode";
import { SplitNode } from "./SplitNode";
import { AggregatorNode } from "./AggregatorNode";
import { MergeNode } from "./MergeNode";

export const nodeTypes: NodeTypes = {
  agent: AgentNode,
  trigger: TriggerNode,
  scheduledTrigger: ScheduledTriggerNode,
  if: IfNode,
  switch: SwitchNode,
  http: HttpNode,
  smtp: SmtpNode,
  wait: WaitNode,
  log: LogNode,
  datetime: DateTimeNode,
  edit: EditNode,
  filter: FilterNode,
  sort: SortNode,
  limit: LimitNode,
  split: SplitNode,
  aggregator: AggregatorNode,
  merge: MergeNode,
};
