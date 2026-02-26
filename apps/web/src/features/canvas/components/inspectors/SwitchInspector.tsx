import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SwitchData, SwitchOperator, SwitchRule } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { VariableInput } from "../variable-picker/VariableInput";
import {
  switchHandleLabelFromId,
  switchRuleHandleId,
} from "../../utils/switchHandles";

type SwitchInspectorProps = {
  node: Node<SwitchData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

const OPERATORS: SwitchOperator[] = [
  "==",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "contains",
];

function ruleHeaderLabel(idx: number) {
  return switchHandleLabelFromId(switchRuleHandleId(idx)) ?? `case ${idx + 1}`;
}

function sanitizeRules(data: SwitchData): SwitchRule[] {
  if (!Array.isArray(data.rules)) return [];
  return data.rules.map((r) => ({
    value: typeof r.value === "string" ? r.value : undefined,
    operator:
      r.operator && OPERATORS.includes(r.operator as SwitchOperator)
        ? (r.operator as SwitchOperator)
        : undefined,
    compare: typeof r.compare === "string" ? r.compare : undefined,
  }));
}

export function SwitchInspector({
  node,
  updateData,
  isExpanded,
}: SwitchInspectorProps) {
  const rules = useMemo(() => sanitizeRules(node.data), [node.data]);

  const updateRules = (updater: (rules: SwitchRule[]) => SwitchRule[]) => {
    updateData(node.id, "switch", (d) => ({
      ...d,
      rules: updater(sanitizeRules(d)),
    }));
  };

  const addRule = () => {
    updateRules((rs) => [
      ...rs,
      { value: "", operator: "==", compare: "" },
    ]);
  };

  const removeRule = (idx: number) => {
    updateRules((rs) => rs.filter((_, i) => i !== idx));
  };

  const moveRule = (idx: number, direction: -1 | 1) => {
    updateRules((rs) => {
      const next = [...rs];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return next;
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const updateRuleField = (
    idx: number,
    field: keyof SwitchRule,
    value: string,
  ) => {
    updateRules((rs) =>
      rs.map((r, i) =>
        i === idx
          ? {
              ...r,
              [field]: value,
            }
          : r,
      ),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Rules ({rules.length})
        </div>
        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-1 rounded-[calc(var(--radius)-0.3rem)] border border-border/60 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/70"
        >
          <Plus className="h-3.5 w-3.5" />
          Add rule
        </button>
      </div>

      {rules.length === 0 && (
        <div className="rounded-[calc(var(--radius)-0.3rem)] border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          No rules yet. Add at least one rule to route to different nodes.
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className="rounded-[calc(var(--radius)-0.3rem)] border border-border/60 bg-background/60 p-3 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.03)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                {ruleHeaderLabel(idx)}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveRule(idx, -1)}
                  disabled={idx === 0}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Move rule up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveRule(idx, 1)}
                  disabled={idx === rules.length - 1}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Move rule down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeRule(idx)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  aria-label="Remove rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="space-y-1">
                <label className="block text-[11px] text-muted-foreground">
                  Value
                </label>
                <VariableInput
                  value={rule.value ?? ""}
                  onChange={(v) =>
                    updateRuleField(idx, "value", v)
                  }
                  placeholder="$input.status"
                  nodeId={node.id}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-muted-foreground">
                  Operator
                </label>
                <Select
                  value={rule.operator ?? "=="}
                  onValueChange={(val) =>
                    updateRuleField(idx, "operator", val as SwitchOperator)
                  }
                >
                  <SelectTrigger className="h-auto w-full rounded-[calc(var(--radius)-0.3rem)] border-input bg-muted/30 px-2 py-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op} className="text-xs">
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-muted-foreground">
                  Compare
                </label>
                <input
                  className="w-full rounded-[calc(var(--radius)-0.3rem)] border border-input bg-muted/30 px-2 py-1 text-xs"
                  value={rule.compare ?? ""}
                  onChange={(e) =>
                    updateRuleField(idx, "compare", e.target.value)
                  }
                  placeholder="approved"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[calc(var(--radius)-0.3rem)] border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Fallback output is used when none of the above rules match. Connect it
        to the node that should handle unmatched cases.
        {isExpanded && (
          <div className="mt-1 text-[11px] text-muted-foreground/80">
            Routes are ordered. The first matching rule wins, and its outgoing
            edge is used. Reorder rules to change priority.
          </div>
        )}
      </div>
    </div>
  );
}
