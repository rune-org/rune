"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2, Plus, ChevronRight } from "lucide-react";
import {
  AGENT_FIELD_TYPES,
  HTTP_CREDENTIAL_TYPES,
  HTTP_METHODS,
  isHttpMethod,
  type AgentFieldType,
  type AgentHttpToolConfig,
  type AgentKVField,
  type AgentTool,
} from "@/features/canvas/types";
import { CredentialSelector } from "@/components/shared/CredentialSelector";
import type { CredentialRef } from "@/lib/credentials";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VariableInput } from "../../variable-picker/VariableInput";
import { cn } from "@/lib/cn";

type KVSection = "headers" | "query" | "body";
type AddSection = KVSection | "url";

type ParamSource = "url" | { section: KVSection; idx: number };

type DerivedParam = {
  id: string;
  name: string;
  source: ParamSource;
  description: string;
  type: AgentFieldType;
  required: boolean;
};

function createFieldUiId(): string {
  return `field_${crypto.randomUUID()}`;
}

function deriveParams(cfg: AgentHttpToolConfig): DerivedParam[] {
  const params: DerivedParam[] = [];

  if (cfg.url.mode === "agent") {
    params.push({
      id: "url",
      name: "url",
      source: "url",
      description: cfg.url.agent.description,
      type: cfg.url.agent.type,
      required: cfg.url.agent.required,
    });
  }

  for (const section of ["headers", "query", "body"] as const) {
    (cfg[section] ?? []).forEach((field, idx) => {
      if (field.value.mode === "agent") {
        params.push({
          id: field.ui_id ?? `${section}-${idx}`,
          name: field.key,
          source: { section, idx },
          description: field.value.agent.description,
          type: field.value.agent.type,
          required: field.value.agent.required,
        });
      }
    });
  }

  return params;
}

function patchParam(
  tool: AgentTool,
  source: ParamSource,
  patch: Partial<{ name: string; description: string; type: AgentFieldType; required: boolean }>,
): AgentTool {
  const cfg = tool.config;

  if (source === "url") {
    if (cfg.url.mode !== "agent") return tool;
    return {
      ...tool,
      config: {
        ...cfg,
        url: {
          mode: "agent",
          agent: {
            ...cfg.url.agent,
            ...(patch.description !== undefined && { description: patch.description }),
            ...(patch.type !== undefined && { type: patch.type }),
            ...(patch.required !== undefined && { required: patch.required }),
          },
        },
      },
    };
  }

  const { section, idx } = source;
  const items = [...(cfg[section] ?? [])];
  const item = items[idx];
  if (!item || item.value.mode !== "agent") return tool;

  items[idx] = {
    key: patch.name !== undefined ? patch.name : item.key,
    value: {
      mode: "agent",
      agent: {
        ...item.value.agent,
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.type !== undefined && { type: patch.type }),
        ...(patch.required !== undefined && { required: patch.required }),
      },
    },
  };

  return { ...tool, config: { ...cfg, [section]: items } };
}

function removeParam(tool: AgentTool, source: ParamSource): AgentTool {
  const cfg = tool.config;
  if (source === "url") {
    return { ...tool, config: { ...cfg, url: { mode: "fixed", value: "" } } };
  }
  const { section, idx } = source;
  const items = (cfg[section] ?? []).filter((_, i) => i !== idx);
  return { ...tool, config: { ...cfg, [section]: items } };
}

function addParam(tool: AgentTool, name: string, section: AddSection): AgentTool {
  const cfg = tool.config;
  if (section === "url") {
    return {
      ...tool,
      config: {
        ...cfg,
        url: { mode: "agent", agent: { description: "", type: "string", required: true } },
      },
    };
  }
  const newField: AgentKVField = {
    ui_id: createFieldUiId(),
    key: name,
    value: { mode: "agent", agent: { description: "", type: "string", required: true } },
  };
  return { ...tool, config: { ...cfg, [section]: [...(cfg[section] ?? []), newField] } };
}

function updateFixedSection(
  tool: AgentTool,
  section: KVSection,
  updatedFixed: AgentKVField[],
): AgentTool {
  const cfg = tool.config;
  const nextItems: AgentKVField[] = [];
  let fixedIdx = 0;

  for (const item of cfg[section] ?? []) {
    if (item.value.mode === "agent") {
      nextItems.push(item);
      continue;
    }

    const updated = updatedFixed[fixedIdx];
    fixedIdx += 1;
    if (updated) nextItems.push(updated);
  }

  return {
    ...tool,
    config: { ...cfg, [section]: [...nextItems, ...updatedFixed.slice(fixedIdx)] },
  };
}

function fixedStr(mode: AgentHttpToolConfig["url"] | AgentKVField["value"]): string {
  if (
    mode.mode === "fixed" &&
    (typeof mode.value === "string" ||
      typeof mode.value === "number" ||
      typeof mode.value === "boolean")
  ) {
    return String(mode.value);
  }
  return "";
}

function urlSummary(url: AgentHttpToolConfig["url"]): string {
  if (url.mode === "agent") return "param";
  const v = typeof url.value === "string" ? url.value : "";
  if (!v) return "—";
  try {
    const u = new URL(v);
    const path = u.pathname !== "/" ? u.pathname : "";
    return (u.hostname + path).slice(0, 28);
  } catch {
    return v.slice(0, 28);
  }
}

type ToolCardProps = {
  tool: AgentTool;
  nodeId: string;
  onChange: (next: AgentTool) => void;
  onRemove: () => void;
};

export function ToolCard({ tool, nodeId, onChange, onRemove }: ToolCardProps) {
  const [sanitizeHint, setSanitizeHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const params = deriveParams(tool.config);

  useEffect(
    () => () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    },
    [],
  );

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = raw.replace(/[^a-zA-Z0-9_]/g, "_");
    if (sanitized !== raw) {
      setSanitizeHint(true);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setSanitizeHint(false), 2000);
    }
    onChange({ ...tool, name: sanitized });
  };

  return (
    <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-background/40">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <MethodBadge method={tool.config.method ?? "GET"} />
        <input
          type="text"
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 font-mono text-xs hover:border-input focus:border-input focus:outline-none"
          value={tool.name}
          onChange={handleNameChange}
          placeholder="tool_name"
        />
        <span className="max-w-24 shrink-0 truncate text-[10px] text-muted-foreground/60">
          {urlSummary(tool.config.url)}
        </span>
        <button
          type="button"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onRemove}
          aria-label="Remove tool"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="border-t border-border/40 px-2 py-2">
        {sanitizeHint && (
          <p className="mb-1 text-[10px] text-muted-foreground/70">
            Special characters replaced with _
          </p>
        )}
        <textarea
          className="w-full resize-y rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-xs"
          rows={2}
          value={tool.description}
          onChange={(e) => onChange({ ...tool, description: e.target.value })}
          placeholder="Describe when the agent should call this tool…"
        />
      </div>

      <ParametersSection tool={tool} params={params} nodeId={nodeId} onChange={onChange} />

      <RequestSection tool={tool} nodeId={nodeId} onChange={onChange} />
    </div>
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PATCH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-mono font-medium",
        METHOD_COLORS[method] ?? "bg-muted/30 text-muted-foreground border-border/40",
      )}
    >
      {method}
    </span>
  );
}

function ParametersSection({
  tool,
  params,
  nodeId,
  onChange,
}: {
  tool: AgentTool;
  params: DerivedParam[];
  nodeId: string;
  onChange: (next: AgentTool) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSection, setNewSection] = useState<AddSection>("query");
  const urlIsParam = tool.config.url.mode === "agent";

  const handleAdd = () => {
    const name = newSection === "url" ? "url" : newName.trim();
    if (!name) return;
    onChange(addParam(tool, name, newSection));
    setNewName("");
    setIsAdding(false);
  };

  return (
    <details className="border-t border-border/40" open>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-3 w-3 shrink-0 transition-transform in-[[open]]:rotate-90" />
        <span>Parameters</span>
        {params.length > 0 && (
          <span className="rounded bg-muted px-1 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {params.length}
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/60">agent-supplied</span>
      </summary>

      <div className="space-y-2 px-2 pb-2">
        {params.length === 0 && !isAdding && (
          <p className="text-xs text-muted-foreground/70">
            No parameters yet — the agent will call this tool with fixed inputs only.
          </p>
        )}

        {params.map((param) => (
          <ParameterRow
            key={param.id}
            param={param}
            nodeId={nodeId}
            onUpdate={(patch) => onChange(patchParam(tool, param.source, patch))}
            onRemove={() => onChange(removeParam(tool, param.source))}
          />
        ))}

        {isAdding ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {newSection !== "url" && (
              <input
                type="text"
                autoFocus
                className="w-28 rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 font-mono text-xs"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Header-Name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") setIsAdding(false);
                }}
              />
            )}
            <Select value={newSection} onValueChange={(v) => setNewSection(v as AddSection)}>
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="query">Query param</SelectItem>
                <SelectItem value="body">Body field</SelectItem>
                <SelectItem value="headers">Header</SelectItem>
                {!urlIsParam && <SelectItem value="url">URL</SelectItem>}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={handleAdd}
              className="rounded bg-ring px-2 py-1 text-[10px] font-medium text-background hover:opacity-90"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewName("");
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add parameter
          </button>
        )}
      </div>
    </details>
  );
}

const SOURCE_BADGE: Record<string, string> = {
  url: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  query: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  body: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  headers: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

function sourceLabel(source: ParamSource): string {
  if (source === "url") return "url";
  return source.section;
}

function ParameterRow({
  param,
  nodeId,
  onUpdate,
  onRemove,
}: {
  param: DerivedParam;
  nodeId: string;
  onUpdate: (
    patch: Partial<{
      name: string;
      description: string;
      type: AgentFieldType;
      required: boolean;
    }>,
  ) => void;
  onRemove: () => void;
}) {
  const isUrl = param.source === "url";
  const label = sourceLabel(param.source);

  return (
    <div className="space-y-1.5 rounded border border-border/40 bg-muted/10 p-2">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-mono",
            SOURCE_BADGE[label] ?? "bg-muted/20 text-muted-foreground border-border/40",
          )}
        >
          {label}
        </span>
        {isUrl ? (
          <span className="flex-1 font-mono text-xs text-muted-foreground">url</span>
        ) : (
          <input
            type="text"
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 font-mono text-xs hover:border-input focus:border-input focus:outline-none"
            value={param.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Header-Name"
          />
        )}
        <Select value={param.type} onValueChange={(v) => onUpdate({ type: v as AgentFieldType })}>
          <SelectTrigger className="h-6 w-18 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_FIELD_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            checked={param.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
          />
          req
        </label>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onRemove}
          aria-label="Remove parameter"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <VariableInput
        value={param.description}
        onChange={(v: string) => onUpdate({ description: v })}
        placeholder="Describe what the agent should provide here…"
        nodeId={nodeId}
      />
    </div>
  );
}

function RequestSection({
  tool,
  nodeId,
  onChange,
}: {
  tool: AgentTool;
  nodeId: string;
  onChange: (next: AgentTool) => void;
}) {
  const cfg = tool.config;
  const patchCfg = (patch: Partial<AgentHttpToolConfig>) =>
    onChange({ ...tool, config: { ...cfg, ...patch } });

  const fixedHeaders = (cfg.headers ?? []).filter((h) => h.value.mode === "fixed");
  const fixedQuery = (cfg.query ?? []).filter((q) => q.value.mode === "fixed");
  const fixedBody = (cfg.body ?? []).filter((b) => b.value.mode === "fixed");
  const isUrlParam = cfg.url.mode === "agent";

  return (
    <details className="border-t border-border/40">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-3 w-3 shrink-0 transition-transform in-[[open]]:rotate-90" />
        <span>Request</span>
        <span className="ml-auto text-[10px] text-muted-foreground/60">fixed config</span>
      </summary>

      <div className="space-y-3 px-2 pb-3">
        {/* Method + URL */}
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">Method & URL</label>
          <div className="flex gap-2">
            <Select
              value={cfg.method ?? "GET"}
              onValueChange={(v) => {
                if (!isHttpMethod(v)) return;
                patchCfg({ method: v });
              }}
            >
              <SelectTrigger className="h-8 w-24 shrink-0 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isUrlParam ? (
              <div className="flex flex-1 items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border border-dashed border-border/60 bg-muted/10 px-2 py-1 text-xs text-muted-foreground">
                <span className="flex-1">URL is a parameter</span>
                <button
                  type="button"
                  className="shrink-0 text-[10px] underline hover:text-foreground"
                  onClick={() => patchCfg({ url: { mode: "fixed", value: "" } })}
                >
                  Make fixed
                </button>
              </div>
            ) : (
              <div className="min-w-0 flex-1 overflow-hidden">
                <VariableInput
                  value={fixedStr(cfg.url)}
                  onChange={(v: string) => patchCfg({ url: { mode: "fixed", value: v } })}
                  placeholder="https://api.example.com/path"
                  nodeId={nodeId}
                />
              </div>
            )}
          </div>
        </div>

        <CredentialSelector
          credentialType={HTTP_CREDENTIAL_TYPES}
          value={tool.credential ?? undefined}
          onChange={(credential: CredentialRef | null) => onChange({ ...tool, credential })}
          label="Authentication"
          placeholder="Select authentication"
        />

        <FixedKVSection
          title="Fixed query params"
          items={fixedQuery}
          nodeId={nodeId}
          keyPlaceholder="Param name"
          onChange={(updated) => onChange(updateFixedSection(tool, "query", updated))}
        />
        <FixedKVSection
          title="Fixed headers"
          items={fixedHeaders}
          nodeId={nodeId}
          keyPlaceholder="Header name"
          onChange={(updated) => onChange(updateFixedSection(tool, "headers", updated))}
        />
        <FixedKVSection
          title="Fixed body fields"
          items={fixedBody}
          nodeId={nodeId}
          keyPlaceholder="Field name"
          onChange={(updated) => onChange(updateFixedSection(tool, "body", updated))}
        />

        <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">Advanced</summary>
          <div className="mt-2 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-muted-foreground">Timeout (s)</label>
                <input
                  type="number"
                  className="mt-0.5 w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1"
                  value={cfg.timeout ?? "30"}
                  onChange={(e) => patchCfg({ timeout: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-muted-foreground">Retries</label>
                <input
                  type="number"
                  min={0}
                  className="mt-0.5 w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1"
                  value={cfg.retry ?? "0"}
                  onChange={(e) => patchCfg({ retry: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-muted-foreground">Retry delay (s)</label>
              <input
                type="number"
                min={0}
                className="mt-0.5 w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1"
                value={cfg.retry_delay ?? "0"}
                onChange={(e) => patchCfg({ retry_delay: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-muted-foreground">Raise on status</label>
              <input
                type="text"
                className="mt-0.5 w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 font-mono text-[11px]"
                value={cfg.raise_on_status ?? ""}
                onChange={(e) =>
                  patchCfg({
                    raise_on_status: e.target.value.trim() === "" ? undefined : e.target.value,
                  })
                }
                placeholder="e.g. 4xx, 5xx, 403"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cfg.ignore_ssl ?? false}
                onChange={(e) => patchCfg({ ignore_ssl: e.target.checked })}
              />
              Ignore SSL
            </label>
          </div>
        </details>
      </div>
    </details>
  );
}

function FixedKVSection({
  title,
  items,
  nodeId,
  keyPlaceholder,
  onChange,
}: {
  title: string;
  items: AgentKVField[];
  nodeId: string;
  keyPlaceholder?: string;
  onChange: (next: AgentKVField[]) => void;
}) {
  useEffect(() => {
    if (items.some((item) => !item.ui_id)) {
      onChange(items.map((item) => (item.ui_id ? item : { ...item, ui_id: createFieldUiId() })));
    }
  }, [items, onChange]);

  const update = (idx: number, patch: Partial<AgentKVField>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () =>
    onChange([
      ...items,
      { ui_id: createFieldUiId(), key: "", value: { mode: "fixed", value: "" } },
    ]);

  return (
    <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        {title}
        {items.length > 0 && (
          <span className="ml-1.5 tabular-nums text-muted-foreground/60">({items.length})</span>
        )}
      </summary>
      <div className="mt-2 space-y-2">
        {items.length === 0 && <p className="text-xs text-muted-foreground/70">None defined.</p>}
        {items.map((item, idx) => (
          <div key={item.ui_id ?? item.key} className="flex items-start gap-1.5">
            <input
              type="text"
              className="w-24 shrink-0 rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-xs"
              value={item.key}
              onChange={(e) => update(idx, { key: e.target.value })}
              placeholder={keyPlaceholder}
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <VariableInput
                value={fixedStr(item.value)}
                onChange={(v: string) => update(idx, { value: { mode: "fixed", value: v } })}
                nodeId={nodeId}
              />
            </div>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => remove(idx)}
              aria-label="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + Add
        </button>
      </div>
    </details>
  );
}
