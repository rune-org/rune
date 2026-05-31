import type { Node } from "@xyflow/react";
import type { DateTimeParseData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { VariableInput } from "../variable-picker/VariableInput";
import { TimezoneField } from "./DateTimeInspectorFields";

type Props = {
  node: Node<DateTimeParseData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function DateTimeParseInspector({ node, updateData, isExpanded }: Props) {
  const timezone = node.data.timezone ?? "UTC";

  const update = (updater: (data: DateTimeParseData) => DateTimeParseData) => {
    updateData(node.id, "dateTimeParse", updater);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">Date or timestamp</label>
        <VariableInput
          value={node.data.date ?? ""}
          onChange={(value) => update((d) => ({ ...d, date: value }))}
          placeholder="2026-03-08T15:30:00Z"
          nodeId={node.id}
        />
      </div>
      <TimezoneField
        value={timezone}
        onChange={(value) => update((d) => ({ ...d, timezone: value }))}
      />
      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          Parses a date or timestamp into year, month, day, hour, minute, second, weekday, iso, and
          unix components.
        </div>
      )}
    </div>
  );
}
