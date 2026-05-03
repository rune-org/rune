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
import { DateTimeNowNode } from "./DateTimeNowNode";
import { DateTimeAddNode } from "./DateTimeAddNode";
import { DateTimeSubtractNode } from "./DateTimeSubtractNode";
import { DateTimeFormatNode } from "./DateTimeFormatNode";
import { DateTimeParseNode } from "./DateTimeParseNode";
import { EditNode } from "./EditNode";
import { FilterNode } from "./FilterNode";
import { SortNode } from "./SortNode";
import { LimitNode } from "./LimitNode";
import { SplitNode } from "./SplitNode";
import { AggregatorNode } from "./AggregatorNode";
import { MergeNode } from "./MergeNode";
import { IntegrationNode } from "./IntegrationNode";
import { getIntegrationNodeKinds } from "../integrations/helpers";

const integrationNodeTypes = Object.fromEntries(
  getIntegrationNodeKinds().map((kind) => [kind, IntegrationNode]),
);

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
  dateTimeNow: DateTimeNowNode,
  dateTimeAdd: DateTimeAddNode,
  dateTimeSubtract: DateTimeSubtractNode,
  dateTimeFormat: DateTimeFormatNode,
  dateTimeParse: DateTimeParseNode,
  edit: EditNode,
  filter: FilterNode,
  sort: SortNode,
  limit: LimitNode,
  split: SplitNode,
  aggregator: AggregatorNode,
  merge: MergeNode,
  ...integrationNodeTypes,
};
