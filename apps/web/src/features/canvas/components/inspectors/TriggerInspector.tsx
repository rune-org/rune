import type { Node } from "@xyflow/react";
import type { TriggerData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";

type TriggerInspectorProps = {
  node: Node<TriggerData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function TriggerInspector({
  isExpanded,
}: TriggerInspectorProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-foreground">
        This is a <strong>Manual Trigger</strong> node.
      </div>
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          Workflows with this trigger can only be started manually via the UI or API.
        </div>
      )}
    </div>
  );
}
