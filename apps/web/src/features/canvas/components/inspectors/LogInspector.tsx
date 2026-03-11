import type { Node } from "@xyflow/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LogData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { VariableInput } from "../variable-picker/VariableInput";

type LogInspectorProps = {
  node: Node<LogData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

const LEVELS: NonNullable<LogData["level"]>[] = ["debug", "info", "warn", "error"];

export function LogInspector({ node, updateData, isExpanded }: LogInspectorProps) {
  const updateLogData = (updater: (data: LogData) => LogData) => {
    updateData(node.id, "log", updater);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">Message</label>
        <VariableInput
          value={node.data.message ?? ""}
          onChange={(value) => updateLogData((d) => ({ ...d, message: value }))}
          nodeId={node.id}
          multiline
        />
      </div>

      <div>
        <label className="block text-xs text-muted-foreground">Level</label>
        <Select
          value={node.data.level ?? "info"}
          onValueChange={(value) => updateLogData((d) => ({ ...d, level: value as LogData["level"] }))}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          Use this node to leave a readable breadcrumb in the workflow run, like a note for what happened at this step.
        </div>
      )}
    </div>
  );
}
