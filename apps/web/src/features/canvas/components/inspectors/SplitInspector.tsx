import type { Node } from "@xyflow/react";
import type { SplitData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";

type SplitInspectorProps = {
  node: Node<SplitData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function SplitInspector({
  node,
  updateData,
  isExpanded,
}: SplitInspectorProps) {
  const updateSplitData = (updater: (data: SplitData) => SplitData) => {
    updateData(node.id, "split", updater);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground">Array Field</label>
      <input
        className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
        value={node.data.array_field ?? ""}
        onChange={(e) =>
          updateSplitData((d) => ({ ...d, array_field: e.target.value }))
        }
        placeholder="$json.items"
      />
      <div className="text-xs text-muted-foreground">
        Path to the array field to iterate over.
      </div>
      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          The Split node takes an array and creates a separate execution branch
          for each item. Use with an Aggregator node to collect results back
          together.
        </div>
      )}
    </div>
  );
}
