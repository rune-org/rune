import { INTEGRATION_NODE_KINDS, INTEGRATION_TOOL_BY_KIND, INTEGRATION_TOOLS } from "./catalog";
import type { IntegrationNodeKind } from "./types";

const INTEGRATION_NODE_KIND_SET = new Set<string>(INTEGRATION_NODE_KINDS);

export function isIntegrationNodeKind(value: unknown): value is IntegrationNodeKind {
  return typeof value === "string" && INTEGRATION_NODE_KIND_SET.has(value);
}

export function getIntegrationTool(kind: IntegrationNodeKind) {
  return INTEGRATION_TOOL_BY_KIND[kind];
}

export function getIntegrationNodeKinds(): readonly IntegrationNodeKind[] {
  return INTEGRATION_NODE_KINDS;
}

export function getIntegrationTools() {
  return INTEGRATION_TOOLS;
}
