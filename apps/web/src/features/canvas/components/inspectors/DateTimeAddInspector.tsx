import type { Node } from "@xyflow/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateTimeAddData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { VariableInput } from "../variable-picker/VariableInput";
import { FormatField, TimezoneField, UNIT_OPTIONS } from "./DateTimeInspectorFields";

type Props = {
  node: Node<DateTimeAddData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function DateTimeAddInspector({ node, updateData, isExpanded }: Props) {
  const timezone = node.data.timezone ?? "UTC";
  const format = node.data.format ?? "2006-01-02T15:04:05Z07:00";

  const update = (updater: (data: DateTimeAddData) => DateTimeAddData) => {
    updateData(node.id, "dateTimeAdd", updater);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">Starting date (optional)</label>
        <VariableInput
          value={node.data.date ?? ""}
          onChange={(value) => update((d) => ({ ...d, date: value }))}
          placeholder="2026-03-08T15:30:00Z"
          nodeId={node.id}
        />
        <div className="mt-1 text-[10px] text-muted-foreground/70">
          Leave empty to start from the current time.
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted-foreground">Amount</label>
          <input
            type="number"
            min={0}
            step={1}
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
            value={node.data.amount ?? 1}
            onChange={(event) => update((d) => ({ ...d, amount: Number(event.target.value) }))}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Unit</label>
          <Select
            value={node.data.unit ?? "days"}
            onValueChange={(value) =>
              update((d) => ({ ...d, unit: value as DateTimeAddData["unit"] }))
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <TimezoneField
        value={timezone}
        onChange={(value) => update((d) => ({ ...d, timezone: value }))}
      />
      <FormatField value={format} onChange={(value) => update((d) => ({ ...d, format: value }))} />
      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          Adds the chosen duration to the starting date (or to the current time when empty).
        </div>
      )}
    </div>
  );
}
