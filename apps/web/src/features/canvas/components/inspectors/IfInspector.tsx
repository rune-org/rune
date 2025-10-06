import type { Node } from "@xyflow/react";
import type { IfData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";

type IfInspectorProps = {
  node: Node<IfData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
};

export function IfInspector({ node, updateData }: IfInspectorProps) {
  const updateIfData = (updater: (data: IfData) => IfData) => {
    updateData(node.id, "if", updater);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs text-muted-foreground">Expression</label>
      <input
        className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
        value={node.data.expression ?? ""}
        onChange={(e) =>
          updateIfData((d) => ({
            ...d,
            expression: e.target.value,
          }))
        }
      />
      <div className="text-xs text-muted-foreground">
        Two outputs: true and false.
      </div>
    </div>
  );
}
