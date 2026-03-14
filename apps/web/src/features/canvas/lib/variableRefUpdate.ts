import { parseVariableReferences } from "../hooks/useVariableInput";
import type { CanvasNode } from "../types";

export type AffectedReference = {
  nodeId: string;
  nodeLabel: string;
  fieldPath: string;
  original: string;
};

export type ScanResult = {
  totalRefs: number;
  affectedNodes: string[];
  references: AffectedReference[];
};

const SKIP_KEYS = new Set(["label", "credential", "pinned"]);

type Visitor = (path: string, value: string) => void;

function visitValue(path: string, value: unknown, visitor: Visitor): void {
  if (typeof value === "string") {
    visitor(path, value);
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      visitValue(`${path}[${i}]`, value[i], visitor);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      visitValue(`${path}.${key}`, v, visitor);
    }
  }
}

/**
 * Scan all nodes (except the one being renamed) for `$oldName` variable references.
 */
export function scanVariableReferences(nodes: CanvasNode[], oldName: string): ScanResult {
  const references: AffectedReference[] = [];
  const affectedNodeIds = new Set<string>();

  for (const node of nodes) {
    const data = node.data as Record<string, unknown>;

    for (const [key, val] of Object.entries(data)) {
      if (SKIP_KEYS.has(key)) continue;

      visitValue(key, val, (path, str) => {
        const matches = parseVariableReferences(str);
        for (const m of matches) {
          if (m.nodeName === oldName) {
            affectedNodeIds.add(node.id);
            references.push({
              nodeId: node.id,
              nodeLabel: node.data.label ?? node.id.slice(0, 6),
              fieldPath: path,
              original: m.full,
            });
          }
        }
      });
    }
  }

  return {
    totalRefs: references.length,
    affectedNodes: [...affectedNodeIds],
    references,
  };
}

function replaceInValue<T>(value: T, oldName: string, newName: string): T {
  if (typeof value === "string") {
    let result = "";
    let i = 0;
    while (i < value.length) {
      if (value[i] === "\\" && i + 1 < value.length && value[i + 1] === "$") {
        result += "\\$";
        i += 2;
        continue;
      }

      if (value[i] === "$") {
        const rest = value.slice(i + 1);
        if (
          rest.startsWith(oldName) &&
          (rest.length === oldName.length || !/[a-zA-Z0-9_-]/.test(rest[oldName.length]))
        ) {
          result += `$${newName}`;
          i += 1 + oldName.length;
          continue;
        }
      }

      result += value[i];
      i++;
    }
    return result as T;
  }

  if (Array.isArray(value)) {
    let changed = false;
    const newArr = value.map((item) => {
      const replaced = replaceInValue(item, oldName, newName);
      if (replaced !== item) changed = true;
      return replaced;
    });
    return (changed ? newArr : value) as T;
  }

  if (value !== null && typeof value === "object") {
    let changed = false;
    const newObj: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (SKIP_KEYS.has(key)) {
        newObj[key] = v;
        continue;
      }
      const replaced = replaceInValue(v, oldName, newName);
      if (replaced !== v) changed = true;
      newObj[key] = replaced;
    }
    return (changed ? newObj : value) as T;
  }

  return value;
}

export function replaceVariableReferences(
  nodes: CanvasNode[],
  oldName: string,
  newName: string,
): CanvasNode[] {
  return nodes.map((node) => {
    const newData = replaceInValue(node.data, oldName, newName);
    if (newData === node.data) return node;
    return { ...node, data: newData } as CanvasNode;
  });
}
