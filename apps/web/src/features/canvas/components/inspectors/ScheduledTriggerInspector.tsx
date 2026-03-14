import type { Node } from "@xyflow/react";
import type { ScheduledTriggerData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScheduledTriggerInspectorProps = {
  node: Node<ScheduledTriggerData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

const UNITS = ["seconds", "minutes", "hours", "days"] as const;

export function ScheduledTriggerInspector({
  node,
  updateData,
  isExpanded,
}: ScheduledTriggerInspectorProps) {
  const updateScheduledTriggerData = (
    updater: (data: ScheduledTriggerData) => ScheduledTriggerData
  ) => {
    updateData(node.id, "scheduledTrigger", updater);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted-foreground">Amount</label>
          <input
            type="number"
            min={1}
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
            value={node.data.amount ?? 1}
            onChange={(e) =>
              updateScheduledTriggerData((d) => ({
                ...d,
                amount: Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Unit</label>
          <Select
            value={node.data.unit ?? "minutes"}
            onValueChange={(value) =>
              updateScheduledTriggerData((d) => ({
                ...d,
                unit: value as ScheduledTriggerData["unit"],
              }))
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          Triggers the workflow at regular intervals. The workflow will be executed
          every specified duration automatically.
        </div>
      )}
    </div>
  );
}
