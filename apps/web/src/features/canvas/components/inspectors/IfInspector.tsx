import type { Node } from "@xyflow/react";
import type { IfData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { VariableInput } from "../variable-picker/VariableInput";

type IfInspectorProps = {
  node: Node<IfData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function IfInspector({
  node,
  updateData,
  isExpanded,
}: IfInspectorProps) {
  const updateIfData = (updater: (data: IfData) => IfData) => {
    updateData(node.id, "if", updater);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground">Expression</label>
      <VariableInput
        value={node.data.expression ?? ""}
        onChange={(v) =>
          updateIfData((d) => ({
            ...d,
            expression: v,
          }))
        }
        placeholder="e.g., $HTTP.status > 200"
        nodeId={node.id}
      />
      <div className="text-xs text-muted-foreground">
        Two outputs: true and false.
      </div>
      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          The expression is evaluated to determine which output path to take.
          Use logical operators and comparisons to define your condition.
        </div>
      )}
    </div>
  );
}
