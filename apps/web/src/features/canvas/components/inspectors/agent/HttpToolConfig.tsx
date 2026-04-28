"use client";

import { Trash2 } from "lucide-react";
import {
  HTTP_METHODS,
  isHttpMethod,
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
import { FieldWithModeToggle } from "./FieldWithModeToggle";

const HTTP_CREDENTIAL_TYPES: ("basic_auth" | "header" | "api_key" | "oauth2" | "token")[] = [
  "basic_auth",
  "header",
  "api_key",
  "oauth2",
  "token",
];

type HttpToolConfigProps = {
  tool: AgentTool;
  onChange: (next: AgentTool) => void;
  nodeId: string;
};

/** Mirrors HttpInspector but routes toggleable fields through FieldWithModeToggle. */
export function HttpToolConfig({ tool, onChange, nodeId }: HttpToolConfigProps) {
  const cfg = tool.config;
  const patchCfg = (patch: Partial<AgentHttpToolConfig>) => {
    onChange({ ...tool, config: { ...cfg, ...patch } });
  };

  const handleCredential = (credential: CredentialRef | null) => {
    onChange({ ...tool, credential });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="block text-xs text-muted-foreground">Tool name (LLM-visible)</label>
        <input
          type="text"
          className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm font-mono"
          value={tool.name}
          onChange={(e) =>
            onChange({ ...tool, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })
          }
          placeholder="e.g. get_weather"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs text-muted-foreground">Description (LLM-visible)</label>
        <textarea
          className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
          rows={2}
          value={tool.description}
          onChange={(e) => onChange({ ...tool, description: e.target.value })}
          placeholder="Describe when the agent should call this tool"
        />
      </div>

      <CredentialSelector
        credentialType={HTTP_CREDENTIAL_TYPES}
        value={tool.credential ?? undefined}
        onChange={handleCredential}
        label="Authentication"
        placeholder="Select authentication"
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted-foreground">Method</label>
          <Select
            value={cfg.method ?? "GET"}
            onValueChange={(v) => {
              if (!isHttpMethod(v)) return;
              patchCfg({ method: v });
            }}
          >
            <SelectTrigger className="h-8 text-sm">
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
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Timeout (s)</label>
          <input
            type="number"
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
            value={cfg.timeout ?? "30"}
            onChange={(e) => patchCfg({ timeout: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs text-muted-foreground">URL</label>
        <FieldWithModeToggle
          value={cfg.url}
          onChange={(next) => patchCfg({ url: next })}
          nodeId={nodeId}
          fixedPlaceholder="https://api.example.com/path"
          allowedAgentTypes={["string"]}
        />
      </div>

      <KVList
        title="Headers"
        nodeId={nodeId}
        items={cfg.headers ?? []}
        onChange={(next) => patchCfg({ headers: next })}
        allowedAgentTypes={["string"]}
        keyPlaceholder="Header name"
      />
      <KVList
        title="Query"
        nodeId={nodeId}
        items={cfg.query ?? []}
        onChange={(next) => patchCfg({ query: next })}
        allowedAgentTypes={["string"]}
        keyPlaceholder="Param name"
      />
      <KVList
        title="Body"
        nodeId={nodeId}
        items={cfg.body ?? []}
        onChange={(next) => patchCfg({ body: next })}
        keyPlaceholder="Field name"
      />

      <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Advanced</summary>
        <div className="mt-2 space-y-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={cfg.ignore_ssl ?? false}
              onChange={(e) => patchCfg({ ignore_ssl: e.target.checked })}
            />
            Ignore SSL
          </label>
          <label className="block">Retries</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1"
            value={cfg.retry ?? "0"}
            onChange={(e) => patchCfg({ retry: e.target.value })}
          />
          <label className="block">Retry delay (s)</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1"
            value={cfg.retry_delay ?? "0"}
            onChange={(e) => patchCfg({ retry_delay: e.target.value })}
          />
          <label className="block">Raise on status</label>
          <input
            type="text"
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 font-mono text-[11px]"
            value={cfg.raise_on_status ?? ""}
            onChange={(e) =>
              patchCfg({
                raise_on_status: e.target.value.trim() === "" ? undefined : e.target.value,
              })
            }
            placeholder="e.g. 4xx, 5xx, 403"
          />
        </div>
      </details>
    </div>
  );
}

type KVListProps = {
  title: string;
  items: AgentKVField[];
  onChange: (next: AgentKVField[]) => void;
  nodeId: string;
  keyPlaceholder?: string;
  allowedAgentTypes?: ReadonlyArray<"string" | "number" | "boolean" | "object">;
};

function KVList({ title, items, onChange, nodeId, keyPlaceholder, allowedAgentTypes }: KVListProps) {
  const update = (idx: number, patch: Partial<AgentKVField>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () =>
    onChange([...items, { key: "", value: { mode: "fixed", value: "" } }]);

  return (
    <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">{title}</summary>
      <div className="mt-2 space-y-3">
        {items.length === 0 && (
          <div className="text-xs text-muted-foreground/70">No {title.toLowerCase()} defined.</div>
        )}
        {items.map((item, idx) => (
          <div key={idx} className="space-y-1 rounded border border-border/40 p-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
                value={item.key}
                onChange={(e) => update(idx, { key: e.target.value })}
                placeholder={keyPlaceholder}
              />
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => remove(idx)}
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <FieldWithModeToggle
              value={item.value}
              onChange={(v) => update(idx, { value: v })}
              nodeId={nodeId}
              allowedAgentTypes={allowedAgentTypes}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          + Add {title.toLowerCase().replace(/s$/, "")}
        </button>
      </div>
    </details>
  );
}
