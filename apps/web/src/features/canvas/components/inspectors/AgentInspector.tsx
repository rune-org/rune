"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import type { Node } from "@xyflow/react";
import { Trash2, Plus } from "lucide-react";
import {
  GEMINI_BACKENDS,
  type AgentData,
  type AgentMcpServer,
  type AgentMessage,
  type AgentProvider,
  type AgentTool,
  type GeminiBackend,
} from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CredentialSelector } from "@/components/shared/CredentialSelector";
import type { CredentialRef } from "@/lib/credentials";
import type { CredentialType } from "@/client/types.gen";
import { VariableInput } from "../variable-picker/VariableInput";
import { ToolCard } from "./agent/ToolCard";
import { agentTabStore, isAgentTab, type AgentTab } from "../../stores/agentTabStore";

const GEMINI_BACKEND_LABELS: Record<GeminiBackend, string> = {
  ai_studio: "Google AI Studio",
  vertex: "Vertex AI (Express)",
};

const MODEL_CREDENTIAL_TYPES_BY_PROVIDER: Record<AgentProvider, CredentialType[]> = {
  gemini: ["gemini_api_key"],
  openai: ["api_key"],
  anthropic: ["api_key"],
};

const GEMINI_MODEL_PRESETS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

const CUSTOM_MODEL_VALUE = "__custom__";

const DEFAULT_GEMINI_MODEL = {
  provider: "gemini" as AgentProvider,
  name: GEMINI_MODEL_PRESETS[0],
  backend: "ai_studio" as GeminiBackend,
  temperature: 0.2,
};

function createUiId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function resolveModelSelectValue(name: string | undefined): string {
  if (!name) return GEMINI_MODEL_PRESETS[0];
  return (GEMINI_MODEL_PRESETS as readonly string[]).includes(name) ? name : CUSTOM_MODEL_VALUE;
}

function TabCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-muted px-1 py-px text-[9px] tabular-nums leading-none">
      {count}
    </span>
  );
}

type AgentInspectorProps = {
  node: Node<AgentData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function AgentInspector({ node, updateData, isExpanded }: AgentInspectorProps) {
  const data = node.data;
  const update = (updater: (d: AgentData) => AgentData) => {
    updateData(node.id, "agent", updater);
  };

  const tabRequest = useSyncExternalStore(
    agentTabStore.subscribe,
    agentTabStore.getSnapshot,
    agentTabStore.getServerSnapshot,
  );
  const [activeTab, setActiveTab] = useState<AgentTab>("model");

  useEffect(() => {
    if (tabRequest?.nodeId === node.id) {
      setActiveTab(tabRequest.tab);
      agentTabStore.consume();
    }
  }, [tabRequest, node.id]);

  const toolCount = data.tools?.length ?? 0;
  const mcpCount = data.mcp_servers?.length ?? 0;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (isAgentTab(value)) setActiveTab(value);
      }}
    >
      <TabsList className="grid w-full grid-cols-4 h-8">
        <TabsTrigger value="model" className="text-[11px] px-1">
          Model
        </TabsTrigger>
        <TabsTrigger value="prompt" className="text-[11px] px-1">
          Prompt
        </TabsTrigger>
        <TabsTrigger value="tools" className="text-[11px] px-1 gap-1">
          Tools
          <TabCount count={toolCount} />
        </TabsTrigger>
        <TabsTrigger value="mcp" className="text-[11px] px-1 gap-1">
          MCP
          <TabCount count={mcpCount} />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="model" className="mt-3">
        <ModelTab node={node} update={update} isExpanded={isExpanded} />
      </TabsContent>

      <TabsContent value="prompt" className="mt-3">
        <PromptTab
          systemPrompt={data.system_prompt ?? ""}
          messages={data.messages ?? []}
          nodeId={node.id}
          onSystemPromptChange={(v) => update((d) => ({ ...d, system_prompt: v }))}
          onMessagesChange={(messages) => update((d) => ({ ...d, messages }))}
        />
      </TabsContent>

      <TabsContent value="tools" className="mt-3">
        <ToolsTab
          tools={data.tools ?? []}
          nodeId={node.id}
          onChange={(tools) => update((d) => ({ ...d, tools }))}
        />
      </TabsContent>

      <TabsContent value="mcp" className="mt-3">
        <McpTab
          servers={data.mcp_servers ?? []}
          onChange={(mcp_servers) => update((d) => ({ ...d, mcp_servers }))}
        />
      </TabsContent>
    </Tabs>
  );
}

function ModelTab({
  node,
  update,
  isExpanded,
}: {
  node: Node<AgentData>;
  update: (updater: (d: AgentData) => AgentData) => void;
  isExpanded: boolean;
}) {
  const data = node.data;
  const model =
    data.model?.provider === "gemini"
      ? data.model
      : { ...DEFAULT_GEMINI_MODEL, name: data.model?.name ?? DEFAULT_GEMINI_MODEL.name };

  useEffect(() => {
    if (data.model?.provider && data.model.provider !== "gemini") {
      update((d) => ({
        ...d,
        model: {
          ...DEFAULT_GEMINI_MODEL,
          name: d.model?.name ?? DEFAULT_GEMINI_MODEL.name,
          temperature: d.model?.temperature ?? DEFAULT_GEMINI_MODEL.temperature,
        },
        credential: null,
      }));
    }
  }, [data.model?.provider, update]);

  const modelSelectValue = resolveModelSelectValue(model.name);
  const [isCustomModel, setIsCustomModel] = useState(() => modelSelectValue === CUSTOM_MODEL_VALUE);
  const lastCustomModelRef = useRef(modelSelectValue === CUSTOM_MODEL_VALUE ? model.name : "");

  useEffect(() => {
    setIsCustomModel(modelSelectValue === CUSTOM_MODEL_VALUE);
    if (modelSelectValue === CUSTOM_MODEL_VALUE) lastCustomModelRef.current = model.name;
  }, [model.name, modelSelectValue, node.id]);

  return (
    <div className="space-y-4">
      {/* Provider */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">Provider</label>
        <Select value="gemini" onValueChange={() => {}}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gemini">Gemini</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">More providers coming soon.</p>
      </div>

      {/* Model name */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">Model</label>
        <Select
          value={isCustomModel ? CUSTOM_MODEL_VALUE : modelSelectValue}
          onValueChange={(v) => {
            if (v === CUSTOM_MODEL_VALUE) {
              setIsCustomModel(true);
              update((d) => ({
                ...d,
                model: {
                  ...DEFAULT_GEMINI_MODEL,
                  ...(d.model ?? model),
                  provider: "gemini",
                  name: lastCustomModelRef.current,
                },
              }));
              return;
            }
            setIsCustomModel(false);
            update((d) => ({
              ...d,
              model: {
                ...DEFAULT_GEMINI_MODEL,
                ...(d.model ?? model),
                provider: "gemini",
                name: v,
              },
            }));
          }}
        >
          <SelectTrigger className="h-auto min-h-8 py-1.5 text-xs font-mono">
            <SelectValue className="truncate" />
          </SelectTrigger>
          <SelectContent>
            {GEMINI_MODEL_PRESETS.map((m) => (
              <SelectItem key={m} value={m} className="font-mono text-xs">
                {m}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_MODEL_VALUE} className="text-xs">
              Custom…
            </SelectItem>
          </SelectContent>
        </Select>
        {isCustomModel && (
          <input
            type="text"
            className="mt-1.5 w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm font-mono"
            value={model.name ?? ""}
            onChange={(e) => {
              lastCustomModelRef.current = e.target.value;
              update((d) => ({
                ...d,
                model: {
                  ...DEFAULT_GEMINI_MODEL,
                  ...(d.model ?? model),
                  provider: "gemini",
                  name: e.target.value,
                },
              }));
            }}
            placeholder="e.g. gemini-2.0-flash"
            autoFocus
          />
        )}
      </div>

      {/* Backend (Gemini-specific) */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">Backend</label>
        <Select
          value={model.backend ?? "ai_studio"}
          onValueChange={(v) =>
            update((d) => ({
              ...d,
              model: {
                ...DEFAULT_GEMINI_MODEL,
                ...(d.model ?? model),
                provider: "gemini",
                backend: v as GeminiBackend,
              },
            }))
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GEMINI_BACKENDS.map((b) => (
              <SelectItem key={b} value={b}>
                {GEMINI_BACKEND_LABELS[b]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Temperature slider */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-muted-foreground">Temperature</label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {(model.temperature ?? 0.2).toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          className="w-full accent-ring"
          value={model.temperature ?? 0.2}
          onChange={(e) =>
            update((d) => ({
              ...d,
              model: {
                ...DEFAULT_GEMINI_MODEL,
                ...(d.model ?? model),
                provider: "gemini",
                temperature: Number(e.target.value),
              },
            }))
          }
        />
        <div className="flex justify-between text-[10px] text-muted-foreground/60">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </div>

      {/* API Key */}
      <CredentialSelector
        credentialType={MODEL_CREDENTIAL_TYPES_BY_PROVIDER[model.provider]}
        value={data.credential}
        onChange={(credential: CredentialRef | null) => update((d) => ({ ...d, credential }))}
        label="API Key"
        placeholder="Select API key credential"
        showHelp={isExpanded}
      />
    </div>
  );
}

function PromptTab({
  systemPrompt,
  messages,
  nodeId,
  onSystemPromptChange,
  onMessagesChange,
}: {
  systemPrompt: string;
  messages: AgentMessage[];
  nodeId: string;
  onSystemPromptChange: (v: string) => void;
  onMessagesChange: (next: AgentMessage[]) => void;
}) {
  const updateMsg = (idx: number, patch: Partial<AgentMessage>) =>
    onMessagesChange(messages.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  const removeMsg = (idx: number) => onMessagesChange(messages.filter((_, i) => i !== idx));
  const addMsg = () =>
    onMessagesChange([...messages, { ui_id: createUiId("message"), role: "user", content: "" }]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-muted-foreground">System prompt</label>
        <div className="mt-1">
          <VariableInput
            value={systemPrompt}
            onChange={onSystemPromptChange}
            placeholder="You are a helpful assistant…"
            nodeId={nodeId}
          />
        </div>
      </div>

      <div className="border-t border-border/40" />

      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">Messages</label>
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground/70">
            Add at least one user message — it becomes the agent&apos;s next turn.
          </p>
        )}
        {messages.map((msg, idx) => (
          <div
            key={msg.ui_id ?? `${msg.role}-${msg.content}`}
            className="space-y-1 rounded border border-border/40 p-2"
          >
            <div className="flex items-center gap-2">
              <Select
                value={msg.role}
                onValueChange={(v) => updateMsg(idx, { role: v as AgentMessage["role"] })}
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="model">model</SelectItem>
                </SelectContent>
              </Select>
              <button
                type="button"
                className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => removeMsg(idx)}
                aria-label="Remove message"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <VariableInput
              value={msg.content}
              onChange={(v) => updateMsg(idx, { content: v })}
              placeholder="Message content (supports $Node refs)"
              nodeId={nodeId}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addMsg}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add message
        </button>
      </div>
    </div>
  );
}

function ToolsTab({
  tools,
  nodeId,
  onChange,
}: {
  tools: AgentTool[];
  nodeId: string;
  onChange: (next: AgentTool[]) => void;
}) {
  const update = (idx: number, next: AgentTool) =>
    onChange(tools.map((t, i) => (i === idx ? next : t)));
  const remove = (idx: number) => onChange(tools.filter((_, i) => i !== idx));
  const add = () =>
    onChange([
      ...tools,
      {
        ui_id: createUiId("tool"),
        type: "http_request",
        name: `tool_${tools.length + 1}`,
        description: "",
        credential: null,
        config: {
          method: "GET",
          url: { mode: "fixed", value: "" },
          headers: [],
          query: [],
          body: [],
        },
      },
    ]);

  return (
    <div className="space-y-3">
      {tools.length === 0 && (
        <p className="text-xs text-muted-foreground/70">
          No tools defined. Tools let the agent call external APIs during a run.
        </p>
      )}
      {tools.map((tool, idx) => (
        <ToolCard
          key={tool.ui_id ?? tool.name}
          tool={tool}
          nodeId={nodeId}
          onChange={(next) => update(idx, next)}
          onRemove={() => remove(idx)}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Add tool
      </button>
    </div>
  );
}

const MCP_CRED_TYPES: ("header" | "token" | "api_key" | "basic_auth")[] = [
  "header",
  "token",
  "api_key",
  "basic_auth",
];

function McpTab({
  servers,
  onChange,
}: {
  servers: AgentMcpServer[];
  onChange: (next: AgentMcpServer[]) => void;
}) {
  const update = (idx: number, patch: Partial<AgentMcpServer>) =>
    onChange(servers.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const remove = (idx: number) => onChange(servers.filter((_, i) => i !== idx));
  const add = () =>
    onChange([
      ...servers,
      {
        name: `server_${servers.length + 1}`,
        transport: "streamable_http",
        url: "",
        credential: null,
      },
    ]);

  return (
    <div className="space-y-3">
      {servers.length === 0 && (
        <p className="text-xs text-muted-foreground/70">
          No MCP servers defined. Connect MCP servers to give the agent access to external tools.
        </p>
      )}
      {servers.map((s, idx) => (
        <div key={idx} className="space-y-2 rounded border border-border/40 p-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
              value={s.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder="Server name"
            />
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => remove(idx)}
              aria-label="Remove server"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground">Transport</label>
            <Select
              value={s.transport}
              onValueChange={(v) => update(idx, { transport: v as AgentMcpServer["transport"] })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="streamable_http">Streamable HTTP</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground">URL</label>
            <input
              type="text"
              className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm font-mono"
              value={s.url}
              onChange={(e) => update(idx, { url: e.target.value })}
              placeholder="https://example.com/mcp"
            />
          </div>

          <CredentialSelector
            credentialType={MCP_CRED_TYPES}
            value={s.credential ?? undefined}
            onChange={(credential) => update(idx, { credential })}
            label="Authentication"
            placeholder="Optional credential"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Add MCP server
      </button>
    </div>
  );
}
