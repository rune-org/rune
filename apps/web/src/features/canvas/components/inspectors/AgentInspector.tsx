"use client";

import type { Node } from "@xyflow/react";
import { Trash2, Plus } from "lucide-react";
import {
  AGENT_PROVIDERS,
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
import { CredentialSelector } from "@/components/shared/CredentialSelector";
import type { CredentialRef } from "@/lib/credentials";
import type { CredentialType } from "@/client/types.gen";
import { VariableInput } from "../variable-picker/VariableInput";
import { HttpToolConfig } from "./agent/HttpToolConfig";

const PROVIDER_LABELS: Record<AgentProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI (coming soon)",
  anthropic: "Anthropic (coming soon)",
};

const GEMINI_BACKEND_LABELS: Record<GeminiBackend, string> = {
  ai_studio: "Google AI Studio",
  vertex: "Vertex AI (Express)",
};

const MODEL_CREDENTIAL_TYPES_BY_PROVIDER: Record<AgentProvider, CredentialType[]> = {
  gemini: ["gemini_api_key"],
  openai: ["api_key"], // placeholder until openai_api_key exists
  anthropic: ["api_key"], // placeholder until anthropic_api_key exists
};

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

  const model = data.model ?? {
    provider: "gemini" as AgentProvider,
    name: "gemini-3.1-flash-lite-preview",
    backend: "ai_studio" as GeminiBackend,
    temperature: 0.2,
  };

  return (
    <div className="space-y-3">
      <details
        className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
        open
      >
        <summary className="cursor-pointer text-xs text-muted-foreground">Model</summary>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground">Provider</label>
              <Select
                value={model.provider}
                onValueChange={(v) =>
                  update((d) => {
                    const provider = v as AgentProvider;
                    // The saved credential may be the wrong type for the new provider; clear it.
                    return {
                      ...d,
                      model: { ...(d.model ?? model), provider },
                      credential: provider === d.model?.provider ? d.credential : null,
                    };
                  })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p} disabled={p !== "gemini"}>
                      {PROVIDER_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Model name</label>
              <input
                type="text"
                className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm font-mono"
                value={model.name ?? ""}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    model: { ...(d.model ?? model), name: e.target.value },
                  }))
                }
                placeholder="gemini-3.1-flash-lite-preview"
              />
            </div>
          </div>
          {model.provider === "gemini" && (
            <div>
              <label className="block text-xs text-muted-foreground">Backend</label>
              <Select
                value={model.backend ?? "ai_studio"}
                onValueChange={(v) =>
                  update((d) => ({
                    ...d,
                    model: { ...(d.model ?? model), backend: v as GeminiBackend },
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
          )}
          <div>
            <label className="block text-xs text-muted-foreground">Temperature</label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={2}
              className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
              value={model.temperature ?? 0.2}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  model: { ...(d.model ?? model), temperature: Number(e.target.value) },
                }))
              }
            />
          </div>
          <CredentialSelector
            credentialType={MODEL_CREDENTIAL_TYPES_BY_PROVIDER[model.provider]}
            value={data.credential}
            onChange={(credential: CredentialRef | null) => update((d) => ({ ...d, credential }))}
            label="API Key"
            placeholder="Select API key credential"
            showHelp={isExpanded}
          />
        </div>
      </details>

      <details
        className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
        open={isExpanded}
      >
        <summary className="cursor-pointer text-xs text-muted-foreground">System prompt</summary>
        <div className="mt-2">
          <VariableInput
            value={data.system_prompt ?? ""}
            onChange={(v) => update((d) => ({ ...d, system_prompt: v }))}
            placeholder="You are a helpful assistant…"
            nodeId={node.id}
          />
        </div>
      </details>

      <MessagesSection
        messages={data.messages ?? []}
        nodeId={node.id}
        onChange={(messages) => update((d) => ({ ...d, messages }))}
      />

      <ToolsSection
        tools={data.tools ?? []}
        nodeId={node.id}
        onChange={(tools) => update((d) => ({ ...d, tools }))}
      />

      <McpSection
        servers={data.mcp_servers ?? []}
        onChange={(mcp_servers) => update((d) => ({ ...d, mcp_servers }))}
      />
    </div>
  );
}

function MessagesSection({
  messages,
  nodeId,
  onChange,
}: {
  messages: AgentMessage[];
  nodeId: string;
  onChange: (next: AgentMessage[]) => void;
}) {
  const update = (idx: number, patch: Partial<AgentMessage>) =>
    onChange(messages.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  const remove = (idx: number) => onChange(messages.filter((_, i) => i !== idx));
  const add = () => onChange([...messages, { role: "user", content: "" }]);

  return (
    <details
      className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
      open
    >
      <summary className="cursor-pointer text-xs text-muted-foreground">Messages</summary>
      <div className="mt-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground/70">
            Add at least one user message — it becomes the agent&apos;s next turn.
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className="space-y-1 rounded border border-border/40 p-2">
            <div className="flex items-center gap-2">
              <Select
                value={msg.role}
                onValueChange={(v) => update(idx, { role: v as AgentMessage["role"] })}
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
                onClick={() => remove(idx)}
                aria-label="Remove message"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <VariableInput
              value={msg.content}
              onChange={(v) => update(idx, { content: v })}
              placeholder="Message content (supports $Node refs)"
              nodeId={nodeId}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add message
        </button>
      </div>
    </details>
  );
}

function ToolsSection({
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
    <details
      className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
      open
    >
      <summary className="cursor-pointer text-xs text-muted-foreground">Tools</summary>
      <div className="mt-2 space-y-3">
        {tools.length === 0 && (
          <div className="text-xs text-muted-foreground/70">No tools defined.</div>
        )}
        {tools.map((tool, idx) => (
          <details
            key={idx}
            className="rounded border border-border/40 bg-background/40"
            open={tool.name === "" || tool.description === ""}
          >
            <summary className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs">
              <span className="font-mono">{tool.name || "(unnamed)"}</span>
              <span className="text-muted-foreground/70">— http_request</span>
              <button
                type="button"
                className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  remove(idx);
                }}
                aria-label="Remove tool"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </summary>
            <div className="border-t border-border/40 p-2">
              <HttpToolConfig tool={tool} onChange={(next) => update(idx, next)} nodeId={nodeId} />
            </div>
          </details>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add http_request tool
        </button>
      </div>
    </details>
  );
}

const MCP_CRED_TYPES: ("header" | "token" | "api_key" | "basic_auth")[] = [
  "header",
  "token",
  "api_key",
  "basic_auth",
];

function McpSection({
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
    <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">MCP Servers</summary>
      <div className="mt-2 space-y-3">
        {servers.length === 0 && (
          <div className="text-xs text-muted-foreground/70">No MCP servers defined.</div>
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
            <div className="grid grid-cols-2 gap-2">
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
              <input
                type="text"
                className="rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm font-mono"
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
    </details>
  );
}
