import type { Node } from "@xyflow/react";
import type { DateTimeFormatData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { VariableInput } from "../variable-picker/VariableInput";
import { FormatField, TimezoneField } from "./DateTimeInspectorFields";

type Props = {
  node: Node<DateTimeFormatData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function DateTimeFormatInspector({ node, updateData, isExpanded }: Props) {
  const timezone = node.data.timezone ?? "UTC";
  const format = node.data.format ?? "2006-01-02T15:04:05Z07:00";

  const update = (updater: (data: DateTimeFormatData) => DateTimeFormatData) => {
    updateData(node.id, "dateTimeFormat", updater);
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
        <div className="mt-1 text-[10px] text-muted-foreground/70">
          Naive inputs are interpreted in the chosen timezone; inputs with an explicit offset are
          converted.
        </div>
      </div>
      <TimezoneField
        value={timezone}
        onChange={(value) => update((d) => ({ ...d, timezone: value }))}
      />
      <FormatField value={format} onChange={(value) => update((d) => ({ ...d, format: value }))} />
      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          Formats a date or timestamp using the chosen Go time layout in the chosen timezone.
        </div>
      )}
    </div>
  );
}
