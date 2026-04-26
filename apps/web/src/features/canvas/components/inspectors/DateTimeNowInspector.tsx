import type { Node } from "@xyflow/react";
import type { DateTimeNowData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { FormatField, TimezoneField } from "./DateTimeInspectorFields";

type Props = {
  node: Node<DateTimeNowData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function DateTimeNowInspector({ node, updateData, isExpanded }: Props) {
  const timezone = node.data.timezone ?? "UTC";
  const format = node.data.format ?? "2006-01-02T15:04:05Z07:00";

  const update = (updater: (data: DateTimeNowData) => DateTimeNowData) => {
    updateData(node.id, "dateTimeNow", updater);
  };

  return (
    <div className="space-y-3">
      <TimezoneField
        value={timezone}
        onChange={(value) => update((d) => ({ ...d, timezone: value }))}
      />
      <FormatField value={format} onChange={(value) => update((d) => ({ ...d, format: value }))} />
      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          Returns the current time in the chosen timezone.
        </div>
      )}
    </div>
  );
}
