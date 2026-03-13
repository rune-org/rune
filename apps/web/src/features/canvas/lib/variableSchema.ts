import type { NodeKind } from "../types";

export type VariableTreeNode = {
  key: string;
  path: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "unknown";
  sampleValue?: unknown;
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

function inferType(
  value: unknown,
): VariableTreeNode["type"] {
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
 * Arrays: inspects [0] for element structure.
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
    const firstItem = data[0];
    if (firstItem === undefined) {
      return [
        {
          key: "[0]",
          path: `${parentPath}[0]`,
          type: "unknown",
          source: "execution",
        },
      ];
    }
    // Inspect the first element to infer array element structure
    const elementType = inferType(firstItem);
    if (elementType === "object" && typeof firstItem === "object" && firstItem !== null) {
      return jsonToVariableTree(firstItem, `${parentPath}[0]`, maxDepth, currentDepth + 1);
    }
    return [
      {
        key: "[0]",
        path: `${parentPath}[0]`,
        type: elementType,
        sampleValue: firstItem,
        source: "execution",
      },
    ];
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
