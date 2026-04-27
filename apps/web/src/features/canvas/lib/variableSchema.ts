import type { NodeKind } from "../types";

export type VariableTreeNode = {
  key: string;
  path: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "unknown";
  sampleValue?: unknown;
  arrayLength?: number;
  children?: VariableTreeNode[];
  source: "schema" | "execution";
};

export type VariableSource = {
  nodeId: string;
  nodeLabel: string;
  nodeKind: NodeKind;
  rootPath: string;
  children: VariableTreeNode[];
};

const MAX_KEYS = 50;
const MAX_ARRAY_PREVIEW_ITEMS = 10;

function inferType(value: unknown): VariableTreeNode["type"] {
  if (value === null || value === undefined) return "unknown";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

/**
 * Walks arbitrary JSON into a tree of VariableTreeNodes.
 * Arrays: exposes a small concrete preview and stores length for indexed lookup in the picker.
 * Objects: caps at MAX_KEYS keys.
 * Primitives: leaf nodes with type/sample value.
 */
export function jsonToVariableTree(
  data: unknown,
  parentPath: string,
  maxDepth = 5,
  currentDepth = 0,
): VariableTreeNode[] {
  if (currentDepth >= maxDepth) return [];
  if (data === null || data === undefined) return [];

  if (Array.isArray(data)) {
    return data.slice(0, MAX_ARRAY_PREVIEW_ITEMS).map((item, index) => {
      const itemPath = `${parentPath}[${index}]`;
      const itemType = inferType(item);
      const node: VariableTreeNode = {
        key: `[${index}]`,
        path: itemPath,
        type: itemType,
        arrayLength: Array.isArray(item) ? item.length : undefined,
        source: "execution",
      };

      if ((itemType === "object" || itemType === "array") && item !== null) {
        const children = jsonToVariableTree(item, itemPath, maxDepth, currentDepth + 1);
        if (children.length > 0) node.children = children;
      } else {
        node.sampleValue = item;
      }

      return node;
    });
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    const capped = entries.slice(0, MAX_KEYS);

    return capped.map(([key, value]) => {
      const fullPath = `${parentPath}.${key}`;
      const valueType = inferType(value);

      if (valueType === "object" || valueType === "array") {
        return {
          key,
          path: fullPath,
          type: valueType,
          arrayLength: Array.isArray(value) ? value.length : undefined,
          source: "execution" as const,
          children: jsonToVariableTree(value, fullPath, maxDepth, currentDepth + 1),
        };
      }

      return {
        key,
        path: fullPath,
        type: valueType,
        sampleValue: value,
        source: "execution" as const,
      };
    });
  }

  // Primitive at the root level
  return [];
}
