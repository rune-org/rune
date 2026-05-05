"use client";

import {
  AGENT_FIELD_TYPES,
  type AgentFieldMode,
  type AgentFieldType,
} from "@/features/canvas/types";
import { VariableInput } from "../../variable-picker/VariableInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Pencil } from "lucide-react";

type FieldWithModeToggleProps = {
  value: AgentFieldMode;
  onChange: (next: AgentFieldMode) => void;
  nodeId: string;
  fixedPlaceholder?: string;
  /** Restrict the agent-decides "type" dropdown (e.g. headers/url are always strings). */
  allowedAgentTypes?: readonly AgentFieldType[];
};

/** Both branches' state is preserved when toggling so users don't lose work. */
export function FieldWithModeToggle({
  value,
  onChange,
  nodeId,
  fixedPlaceholder,
  allowedAgentTypes = AGENT_FIELD_TYPES,
}: FieldWithModeToggleProps) {
  const isAgent = value.mode === "agent";

  const flipMode = () => {
    if (isAgent) {
      onChange({ mode: "fixed", value: "" });
    } else {
      onChange({
        mode: "agent",
        agent: { description: "", type: allowedAgentTypes[0] ?? "string", required: true },
      });
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={flipMode}
          className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
          title={isAgent ? "Use a fixed value" : "Let the agent decide"}
        >
          {isAgent ? <Pencil className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {isAgent ? "Fixed" : "Agent decides"}
        </button>
      </div>

      {isAgent ? (
        <AgentSlot
          nodeId={nodeId}
          description={value.agent.description}
          type={value.agent.type}
          required={value.agent.required}
          allowedTypes={allowedAgentTypes}
          onChange={(patch) =>
            onChange({
              mode: "agent",
              agent: { ...value.agent, ...patch },
            })
          }
        />
      ) : (
        <VariableInput
          value={typeof value.value === "string" ? value.value : ""}
          onChange={(v) => onChange({ mode: "fixed", value: v })}
          placeholder={fixedPlaceholder}
          nodeId={nodeId}
        />
      )}
    </div>
  );
}

type AgentSlotProps = {
  nodeId: string;
  description: string;
  type: AgentFieldType;
  required: boolean;
  allowedTypes: readonly AgentFieldType[];
  onChange: (
    patch: Partial<{ description: string; type: AgentFieldType; required: boolean }>,
  ) => void;
};

function AgentSlot({
  nodeId,
  description,
  type,
  required,
  allowedTypes,
  onChange,
}: AgentSlotProps) {
  return (
    <div className="space-y-1 rounded border border-dashed border-border/60 bg-muted/10 p-2">
      <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
        Description (what the LLM should put here)
      </label>
      <VariableInput
        value={description}
        onChange={(v) => onChange({ description: v })}
        placeholder="e.g. The customer's user ID"
        nodeId={nodeId}
      />
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Type
          </label>
          <Select value={type} onValueChange={(v) => onChange({ type: v as AgentFieldType })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-1 text-xs text-muted-foreground self-end">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          Required
        </label>
      </div>
    </div>
  );
}
