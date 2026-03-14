import type { Node } from "@xyflow/react";
import type { LimitData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { VariableInput } from "../variable-picker/VariableInput";
import { toArraySelection } from "../../utils/listFieldPaths";

type LimitInspectorProps = {
  node: Node<LimitData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function LimitInspector({ node, updateData, isExpanded }: LimitInspectorProps) {
  const updateLimitData = (updater: (data: LimitData) => LimitData) => {
    updateData(node.id, "limit", updater);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">Take items from</label>
        <VariableInput
          value={node.data.input_array ?? ""}
          onChange={(value) => updateLimitData((d) => ({ ...d, input_array: value }))}
          placeholder="Leave blank to use the incoming list"
          nodeId={node.id}
          transformSelectedPath={toArraySelection}
        />
      </div>

      <div>
        <label className="block text-xs text-muted-foreground">Number of items</label>
        <input
          type="number"
          min={0}
          className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
          value={node.data.count ?? 10}
          onChange={(e) => updateLimitData((d) => ({ ...d, count: Number(e.target.value) }))}
        />
      </div>

      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          Use this node when you want just the first few results, like the top 10 leads or latest 3
          orders.
        </div>
      )}
    </div>
  );
}
