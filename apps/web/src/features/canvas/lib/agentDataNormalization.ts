import type { AgentData, AgentKVField, AgentMessage, AgentTool } from "@/features/canvas/types";

function createAgentUiId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function stripAgentMessageUiId(message: AgentMessage): AgentMessage {
  const next = { ...message };
  delete next.ui_id;
  return next;
}

export function stripAgentKvFieldUiId(field: AgentKVField): AgentKVField {
  const next = { ...field };
  delete next.ui_id;
  return next;
}

export function stripAgentToolUiId(tool: AgentTool): AgentTool {
  const next = { ...tool };
  delete next.ui_id;
  next.config = {
    ...next.config,
    headers: next.config.headers?.map(stripAgentKvFieldUiId),
    query: next.config.query?.map(stripAgentKvFieldUiId),
    body: next.config.body?.map(stripAgentKvFieldUiId),
  };
  return next;
}

export function hydrateAgentMessages(messages: unknown): AgentData["messages"] {
  if (!Array.isArray(messages)) return undefined;
  return (messages as AgentMessage[]).map((message) =>
    message.ui_id ? message : { ...message, ui_id: createAgentUiId("message") },
  );
}

export function hydrateAgentKvFields(
  fields: AgentKVField[] | undefined,
): AgentKVField[] | undefined {
  return fields?.map((field) =>
    field.ui_id ? field : { ...field, ui_id: createAgentUiId("field") },
  );
}

export function hydrateAgentTools(tools: unknown): AgentData["tools"] {
  if (!Array.isArray(tools)) return undefined;
  return (tools as AgentTool[]).map((tool) => ({
    ...tool,
    ui_id: tool.ui_id ?? createAgentUiId("tool"),
    config: {
      ...tool.config,
      headers: hydrateAgentKvFields(tool.config.headers),
      query: hydrateAgentKvFields(tool.config.query),
      body: hydrateAgentKvFields(tool.config.body),
    },
  }));
}
