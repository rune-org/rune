import { useMemo, useRef } from "react";
import type { Node } from "@xyflow/react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortData, SortDirection, SortRule, SortValueType } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { VariableInput } from "../variable-picker/VariableInput";
import { toArraySelection, toListItemSelection } from "../../utils/listFieldPaths";

type SortInspectorProps = {
  node: Node<SortData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded?: boolean;
};

const DIRECTIONS: SortDirection[] = ["asc", "desc", "ascending", "descending"];
const VALUE_TYPES: SortValueType[] = ["auto", "text", "number", "date"];

function sanitizeRules(data: SortData): SortRule[] {
  if (!Array.isArray(data.rules)) return [];
  return data.rules.map((rule) => ({
    field: typeof rule.field === "string" ? rule.field : undefined,
    direction:
      rule.direction && DIRECTIONS.includes(rule.direction)
        ? rule.direction
        : "asc",
    type: rule.type && VALUE_TYPES.includes(rule.type) ? rule.type : "auto",
  }));
}

let nextSortRuleId = 1;

export function SortInspector({ node, updateData, isExpanded }: SortInspectorProps) {
  const rules = useMemo(() => sanitizeRules(node.data), [node.data]);
  const ruleIdsRef = useRef<number[]>([]);
  while (ruleIdsRef.current.length < rules.length) {
    ruleIdsRef.current.push(nextSortRuleId++);
  }
  if (ruleIdsRef.current.length > rules.length) {
    ruleIdsRef.current = ruleIdsRef.current.slice(0, rules.length);
  }

  const updateSortData = (updater: (data: SortData) => SortData) => {
    updateData(node.id, "sort", updater);
  };

  const updateRules = (updater: (rules: SortRule[]) => SortRule[]) => {
    updateSortData((d) => ({ ...d, rules: updater(sanitizeRules(d)) }));
  };

  const addRule = () => {
    ruleIdsRef.current.push(nextSortRuleId++);
    updateRules((existing) => [...existing, { field: "", direction: "asc", type: "auto" }]);
  };

  const removeRule = (index: number) => {
    ruleIdsRef.current.splice(index, 1);
    updateRules((existing) => existing.filter((_, idx) => idx !== index));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    updateRules((existing) => {
      const next = [...existing];
      const target = index + direction;
      if (target < 0 || target >= next.length) return next;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      const ids = ruleIdsRef.current;
      const [movedId] = ids.splice(index, 1);
      ids.splice(target, 0, movedId);
      return next;
    });
  };

  const updateRuleField = (index: number, field: keyof SortRule, value: string) => {
    updateRules((existing) =>
      existing.map((rule, idx) => (idx === index ? { ...rule, [field]: value } : rule)),
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">Take items from</label>
        <VariableInput
          value={node.data.input_array ?? ""}
          onChange={(value) => updateSortData((d) => ({ ...d, input_array: value }))}
          placeholder="Leave blank to use the incoming list"
          nodeId={node.id}
          transformSelectedPath={toArraySelection}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Rules ({rules.length})</div>
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
          No sort rules yet. Add at least one rule to choose the order.
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div
            key={ruleIdsRef.current[index]}
            className="rounded-[calc(var(--radius)-0.3rem)] border border-border/60 bg-background/60 p-3 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.03)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Rule {index + 1}</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveRule(index, -1)}
                  disabled={index === 0}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Move rule up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveRule(index, 1)}
                  disabled={index === rules.length - 1}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Move rule down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  aria-label="Remove rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="space-y-1">
                <label className="block text-[11px] text-muted-foreground">Field</label>
                <VariableInput
                  value={rule.field ?? ""}
                  onChange={(value) => updateRuleField(index, "field", value)}
                  placeholder="$item.id or pick from a sample item"
                  nodeId={node.id}
                  multiline
                  transformSelectedPath={(path) =>
                    toListItemSelection(node.data.input_array, path)
                  }
                />
                <div className="text-[10px] text-muted-foreground/70">
                  Pick a field from an example item and it will become <code>$item.field</code>. You can also type a field like <code>id</code>.
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-[11px] text-muted-foreground">Direction</label>
                  <Select
                    value={rule.direction ?? "asc"}
                    onValueChange={(value) => updateRuleField(index, "direction", value)}
                  >
                    <SelectTrigger className="h-auto w-full rounded-[calc(var(--radius)-0.3rem)] border-input bg-muted/30 px-2 py-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIRECTIONS.map((direction) => (
                        <SelectItem key={direction} value={direction} className="text-xs">
                          {direction}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-muted-foreground">Type</label>
                  <Select
                    value={rule.type ?? "auto"}
                    onValueChange={(value) => updateRuleField(index, "type", value)}
                  >
                    <SelectTrigger className="h-auto w-full rounded-[calc(var(--radius)-0.3rem)] border-input bg-muted/30 px-2 py-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VALUE_TYPES.map((valueType) => (
                        <SelectItem key={valueType} value={valueType} className="text-xs">
                          {valueType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          Use this node to reorder a list by one or more fields, like sorting products by price or users by signup date.
        </div>
      )}
    </div>
  );
}
