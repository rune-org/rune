import type { Node } from "@xyflow/react";
import type { MergeData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MergeInspectorProps = {
  node: Node<MergeData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

const WAIT_MODES = [
  { value: "wait_for_all", label: "Wait for all branches" },
  { value: "wait_for_any", label: "Wait for any branch" },
] as const;

const BRANCH_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function MergeInspector({
  node,
  updateData,
  isExpanded,
}: MergeInspectorProps) {
  const updateMergeData = (updater: (data: MergeData) => MergeData) => {
    updateData(node.id, "merge", updater);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">
          Number of Branches
        </label>
        <Select
          value={String(node.data.branch_count ?? 2)}
          onValueChange={(value) =>
            updateMergeData((d) => ({
              ...d,
              branch_count: Number(value),
            }))
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRANCH_COUNTS.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count} branches
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-1 text-xs text-muted-foreground/70">
          How many incoming branches to wait for.
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground">Wait Mode</label>
        <Select
          value={node.data.wait_mode ?? "wait_for_all"}
          onValueChange={(value) =>
            updateMergeData((d) => ({
              ...d,
              wait_mode: value as MergeData["wait_mode"],
            }))
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WAIT_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isExpanded && (
          <div className="mt-1 text-xs text-muted-foreground/70">
            {node.data.wait_mode === "wait_for_any"
              ? "Continues when the first branch completes."
              : "Waits until all incoming branches complete."}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-muted-foreground">
          Timeout (seconds)
        </label>
        <input
          type="number"
          min={1}
          className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
          value={node.data.timeout ?? 300}
          onChange={(e) =>
            updateMergeData((d) => ({ ...d, timeout: Number(e.target.value) }))
          }
        />
        {isExpanded && (
          <div className="mt-1 text-xs text-muted-foreground/70">
            Maximum time to wait for branches before timing out.
          </div>
        )}
      </div>
    </div>
  );
}
