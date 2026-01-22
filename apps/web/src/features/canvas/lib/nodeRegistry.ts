import {
  Bot,
  Clock,
  Combine,
  GitBranch,
  Globe,
  Layers,
  Mail,
  Pencil,
  Play,
  Split,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind, NodeDataMap } from "../types";

export type NodeGroup = "triggers" | "core" | "http" | "email" | "agents";

export type NodeColorTheme = {
  /** base color (e.g., "--node-http") */
  base: string;
  /** background (e.g., "--node-http-bg") */
  bg: string;
  /** border (e.g., "--node-http-border") */
  border: string;
};

export type NodeSchema = {
  inputs: readonly string[];
  outputs: readonly string[];
};

export type NodeMetadata<K extends NodeKind = NodeKind> = {
  kind: K;
  label: string;
  icon: LucideIcon;
  colorTheme: NodeColorTheme;
  dimensions: { width: number; height: number };
  defaults: NodeDataMap[K];
  schema: NodeSchema;
  group: NodeGroup;
  isTrigger: boolean;
  hasDynamicOutputs: boolean;
};

export type NodeRegistry = {
  [K in NodeKind]: NodeMetadata<K>;
};

export const NODE_REGISTRY: NodeRegistry = {
  trigger: {
    kind: "trigger",
    label: "Manual Trigger",
    icon: Play,
    colorTheme: {
      base: "--node-trigger",
      bg: "--node-trigger-bg",
      border: "--node-trigger-border",
    },
    dimensions: { width: 160, height: 48 },
    defaults: { label: "Trigger" },
    schema: { inputs: [], outputs: ["trigger"] },
    group: "triggers",
    isTrigger: true,
    hasDynamicOutputs: false,
  },
  agent: {
    kind: "agent",
    label: "Agent",
    icon: Bot,
    colorTheme: {
      base: "--node-agent",
      bg: "--node-agent-bg",
      border: "--node-agent-border",
    },
    dimensions: { width: 220, height: 80 },
    defaults: { label: "Agent" },
    schema: { inputs: ["input"], outputs: ["response"] },
    group: "agents",
    isTrigger: false,
    hasDynamicOutputs: false,
  },
  if: {
    kind: "if",
    label: "If",
    icon: GitBranch,
    colorTheme: {
      base: "--node-core",
      bg: "--node-core-bg",
      border: "--node-core-border",
    },
    dimensions: { width: 200, height: 72 },
    defaults: { label: "If", expression: "{{ var > 10 }}" },
    schema: { inputs: ["condition"], outputs: ["true", "false"] },
    group: "core",
    isTrigger: false,
    hasDynamicOutputs: false,
  },
  switch: {
    kind: "switch",
    label: "Switch",
    icon: GitBranch,
    colorTheme: {
      base: "--node-core",
      bg: "--node-core-bg",
      border: "--node-core-border",
    },
    dimensions: { width: 240, height: 180 },
    defaults: {
      label: "Switch",
      rules: [
        { value: "$input.status", operator: "==", compare: "ok" },
        { value: "$input.status", operator: "==", compare: "error" },
      ],
    },
    schema: { inputs: ["input"], outputs: [] }, // Dynamic based on rules
    group: "core",
    isTrigger: false,
    hasDynamicOutputs: true,
  },
  http: {
    kind: "http",
    label: "HTTP Request",
    icon: Globe,
    colorTheme: {
      base: "--node-http",
      bg: "--node-http-bg",
      border: "--node-http-border",
    },
    dimensions: { width: 220, height: 80 },
    defaults: { label: "HTTP", method: "GET", url: "https://api.example.com" },
    schema: { inputs: ["request"], outputs: ["response", "error"] },
    group: "http",
    isTrigger: false,
    hasDynamicOutputs: false,
  },
  smtp: {
    kind: "smtp",
    label: "SMTP Email",
    icon: Mail,
    colorTheme: {
      base: "--node-email",
      bg: "--node-email-bg",
      border: "--node-email-border",
    },
    dimensions: { width: 220, height: 80 },
    defaults: {
      label: "SMTP",
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Hello from Rune",
      body: "This is a test email",
    },
    schema: { inputs: ["email"], outputs: ["sent", "error"] },
    group: "email",
    isTrigger: false,
    hasDynamicOutputs: false,
  },
  wait: {
    kind: "wait",
    label: "Wait",
    icon: Clock,
    colorTheme: {
      base: "--node-core",
      bg: "--node-core-bg",
      border: "--node-core-border",
    },
    dimensions: { width: 220, height: 72 },
    defaults: { label: "Wait", amount: 1, unit: "seconds" },
    schema: { inputs: ["input"], outputs: ["resume"] },
    group: "core",
    isTrigger: false,
    hasDynamicOutputs: false,
  },
  edit: {
    kind: "edit",
    label: "Edit",
    icon: Pencil,
    colorTheme: {
      base: "--node-core",
      bg: "--node-core-bg",
      border: "--node-core-border",
    },
    dimensions: { width: 220, height: 72 },
    defaults: {
      label: "Edit",
      mode: "assignments",
      assignments: [{ name: "newField", value: "{{ $json.existingField }}", type: "string" }],
    },
    schema: { inputs: ["input"], outputs: ["output"] },
    group: "core",
    isTrigger: false,
    hasDynamicOutputs: false,
  },
  split: {
    kind: "split",
    label: "Split",
    icon: Split,
    colorTheme: {
      base: "--node-core",
      bg: "--node-core-bg",
      border: "--node-core-border",
    },
    dimensions: { width: 220, height: 72 },
    defaults: { label: "Split", array_field: "$json.items" },
    schema: { inputs: ["input"], outputs: ["item"] },
    group: "core",
    isTrigger: false,
    hasDynamicOutputs: false,
  },
  aggregator: {
    kind: "aggregator",
    label: "Aggregator",
    icon: Layers,
    colorTheme: {
      base: "--node-core",
      bg: "--node-core-bg",
      border: "--node-core-border",
    },
    dimensions: { width: 220, height: 72 },
    defaults: { label: "Aggregator" },
    schema: { inputs: ["items"], outputs: ["aggregated"] },
    group: "core",
    isTrigger: false,
    hasDynamicOutputs: false,
  },
  merge: {
    kind: "merge",
    label: "Merge",
    icon: Combine,
    colorTheme: {
      base: "--node-core",
      bg: "--node-core-bg",
      border: "--node-core-border",
    },
    dimensions: { width: 220, height: 80 },
    defaults: { label: "Merge", wait_mode: "wait_for_all", timeout: 300 },
    schema: { inputs: ["branches"], outputs: ["merged"] },
    group: "core",
    isTrigger: false,
    hasDynamicOutputs: false,
  },
};

// ============================================================================
// Type Guards
// ============================================================================

export function isTriggerNode(kind: NodeKind): boolean {
  return NODE_REGISTRY[kind].isTrigger;
}

export function isValidNodeKind(value: unknown): value is NodeKind {
  return typeof value === "string" && value in NODE_REGISTRY;
}

// ============================================================================
// Icon Helpers
// ============================================================================

/** Get the icon component for a node type */
export function getNodeIcon(kind: NodeKind): LucideIcon {
  return NODE_REGISTRY[kind].icon;
}

// ============================================================================
// Dimension Helpers
// ============================================================================

/** Get the base dimensions for a node type */
export function getNodeDimensions(kind: NodeKind): { width: number; height: number } {
  return NODE_REGISTRY[kind].dimensions;
}

// e.g.: Switch nodes have height based on rule count.
export function getNodeDimensionsWithData(
  kind: NodeKind,
  data?: NodeDataMap[NodeKind],
): { width: number; height: number } {
  const base = NODE_REGISTRY[kind].dimensions;

  if (kind === "switch" && data && "rules" in data) {
    const rules = Array.isArray(data.rules) ? data.rules : [];
    return { width: base.width, height: 64 + (rules.length + 1) * 64 };
  }

  return base;
}

// ============================================================================
// Color Helpers
// ============================================================================

export function getNodeColorTheme(kind: NodeKind): NodeColorTheme {
  return NODE_REGISTRY[kind].colorTheme;
}

export function getNodeColorVar(kind: NodeKind): string {
  return NODE_REGISTRY[kind].colorTheme.base;
}

export function getMiniMapNodeColor(kind: NodeKind): string {
  const varName = NODE_REGISTRY[kind].colorTheme.base;
  return `color-mix(in srgb, var(${varName}) 30%, transparent)`;
}

// ============================================================================
// Schema Helpers
// ============================================================================

export function getNodeSchema(kind: NodeKind, data?: NodeDataMap[NodeKind]): NodeSchema {
  const metadata = NODE_REGISTRY[kind];

  if (metadata.hasDynamicOutputs && kind === "switch") {
    const rules =
      data && "rules" in data && Array.isArray(data.rules) ? data.rules : [];
    const dynamicOutputs = rules.map((_, idx) => `case ${idx + 1}`).concat("fallback");
    return { inputs: metadata.schema.inputs, outputs: dynamicOutputs };
  }

  return metadata.schema;
}

// ============================================================================
// Library/Grouping Helpers
// ============================================================================

type GroupMetadata = {
  label: string;
  icon: LucideIcon;
  colorClass: string;
};

const GROUP_METADATA: Record<NodeGroup, GroupMetadata> = {
  triggers: { label: "Triggers", icon: Play, colorClass: "bg-node-trigger" },
  core: { label: "Core", icon: GitBranch, colorClass: "bg-node-core" },
  http: { label: "HTTP", icon: Globe, colorClass: "bg-node-http" },
  email: { label: "Email", icon: Mail, colorClass: "bg-node-email" },
  agents: { label: "Agents", icon: Bot, colorClass: "bg-node-agent" },
};

export function getNodesByGroup(group: NodeGroup): NodeMetadata[] {
  return Object.values(NODE_REGISTRY).filter((m) => m.group === group);
}

export function getAllGroups(): NodeGroup[] {
  return Object.keys(GROUP_METADATA) as NodeGroup[];
}

export function getGroupLabel(group: NodeGroup): string {
  return GROUP_METADATA[group].label;
}

export function getGroupIcon(group: NodeGroup): LucideIcon {
  return GROUP_METADATA[group].icon;
}

export function getGroupColorClass(group: NodeGroup): string {
  return GROUP_METADATA[group].colorClass;
}

/** Data Helper */
export function getNodeDefaults<K extends NodeKind>(kind: K): { type: K; data: NodeDataMap[K] } {
  const metadata = NODE_REGISTRY[kind];
  return {
    type: kind,
    data: structuredClone(metadata.defaults) as NodeDataMap[K],
  };
}

/** Array of all node kinds for iteration */
export const ALL_NODE_KINDS: readonly NodeKind[] = Object.keys(NODE_REGISTRY) as NodeKind[];
