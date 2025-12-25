import type { Node } from "@xyflow/react";
import type { WaitData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type WaitInspectorProps = {
  node: Node<WaitData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

const UNITS = ["seconds", "minutes", "hours", "days"] as const;

export function WaitInspector({
  node,
  updateData,
  isExpanded,
}: WaitInspectorProps) {
  const updateWaitData = (updater: (data: WaitData) => WaitData) => {
    updateData(node.id, "wait", updater);
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
              updateWaitData((d) => ({ ...d, amount: Number(e.target.value) }))
            }
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Unit</label>
          <Select
            value={node.data.unit ?? "seconds"}
            onValueChange={(value) =>
              updateWaitData((d) => ({
                ...d,
                unit: value as WaitData["unit"],
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
          Suspends workflow execution for the specified duration before
          continuing to the next node.
        </div>
      )}
    </div>
  );
}
