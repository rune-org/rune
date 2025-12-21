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
import type { EditData, EditAssignment } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";

type EditInspectorProps = {
  node: Node<EditData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

const TYPES = ["string", "number", "boolean", "json"] as const;
const MODES = [
  { value: "assignments", label: "Set fields", description: "Add or modify fields while keeping existing data" },
  { value: "keep_only", label: "Replace all", description: "Clear existing data and only set these fields" },
] as const;

function sanitizeAssignments(data: EditData): EditAssignment[] {
  if (!Array.isArray(data.assignments)) return [];
  return data.assignments.map((a) => ({
    name: typeof a.name === "string" ? a.name : undefined,
    value: typeof a.value === "string" ? a.value : undefined,
    type: a.type && TYPES.includes(a.type as (typeof TYPES)[number])
      ? a.type
      : "string",
  }));
}

export function EditInspector({
  node,
  updateData,
  isExpanded,
}: EditInspectorProps) {
  const assignments = useMemo(
    () => sanitizeAssignments(node.data),
    [node.data],
  );
  const mode = node.data.mode ?? "assignments";

  const updateAssignments = (
    updater: (a: EditAssignment[]) => EditAssignment[],
  ) => {
    updateData(node.id, "edit", (d) => ({
      ...d,
      assignments: updater(sanitizeAssignments(d)),
    }));
  };

  const updateMode = (newMode: EditData["mode"]) => {
    updateData(node.id, "edit", (d) => ({ ...d, mode: newMode }));
  };

  const addAssignment = () => {
    updateAssignments((as) => [
      ...as,
      { name: "newField", value: "", type: "string" },
    ]);
  };

  const removeAssignment = (idx: number) => {
    updateAssignments((as) => as.filter((_, i) => i !== idx));
  };

  const moveAssignment = (idx: number, direction: -1 | 1) => {
    updateAssignments((as) => {
      const next = [...as];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return next;
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const updateField = (
    idx: number,
    field: keyof EditAssignment,
    value: string,
  ) => {
    updateAssignments((as) =>
      as.map((a, i) => (i === idx ? { ...a, [field]: value } : a)),
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">Mode</label>
        <Select
          value={mode}
          onValueChange={(v) => updateMode(v as EditData["mode"])}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-1 text-[10px] text-muted-foreground/70">
          {MODES.find((m) => m.value === mode)?.description}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Fields ({assignments.length})
        </div>
        <button
          type="button"
          onClick={addAssignment}
          className="inline-flex items-center gap-1 rounded-[calc(var(--radius)-0.3rem)] border border-border/60 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/70"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {assignments.length === 0 && (
        <div className="rounded-[calc(var(--radius)-0.3rem)] border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          No fields defined.
        </div>
      )}

      <div className="space-y-3">
        {assignments.map((assignment, idx) => (
          <div
            key={idx}
            className="rounded-[calc(var(--radius)-0.3rem)] border border-border/60 bg-background/60 p-3 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.03)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Field {idx + 1}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveAssignment(idx, -1)}
                  disabled={idx === 0}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveAssignment(idx, 1)}
                  disabled={idx === assignments.length - 1}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAssignment(idx)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div>
                <label className="block text-[11px] text-muted-foreground">
                  Name
                </label>
                <input
                  className="w-full rounded-[calc(var(--radius)-0.3rem)] border border-input bg-muted/30 px-2 py-1 text-xs"
                  value={assignment.name ?? ""}
                  onChange={(e) => updateField(idx, "name", e.target.value)}
                  placeholder="field.path"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground">
                  Value
                </label>
                <input
                  className="w-full rounded-[calc(var(--radius)-0.3rem)] border border-input bg-muted/30 px-2 py-1 text-xs"
                  value={assignment.value ?? ""}
                  onChange={(e) =>
                    updateField(idx, "value", e.target.value)
                  }
                  placeholder="{{ $json.field }} or literal"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground">
                  Type
                </label>
                <Select
                  value={assignment.type ?? "string"}
                  onValueChange={(v) => updateField(idx, "type", v)}
                >
                  <SelectTrigger className="h-auto w-full rounded-[calc(var(--radius)-0.3rem)] border-input bg-muted/30 px-2 py-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.3rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          {mode === "assignments"
            ? "Add or modify fields while preserving existing data. Use {{ expressions }} for JavaScript evaluation or literal values."
            : "Start with empty data and only set the fields defined here. Use {{ expressions }} for JavaScript evaluation or literal values."}
        </div>
      )}
    </div>
  );
}
