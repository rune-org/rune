import Fuse from "fuse.js";
import type { NodeKind } from "../types";
import { getIntegrationTool, isIntegrationNodeKind } from "../integrations/helpers";
import { getGroupLabel, isInspectableNode, NODE_REGISTRY, type NodeGroup } from "./nodeRegistry";

export type LibrarySearchItem = {
  kind: NodeKind;
  label: string;
  group: NodeGroup;
  groupLabel: string;
  serviceLabel?: string;
  providerLabel?: string;
  keywords: readonly string[];
  description?: string;
};

let cachedItems: readonly LibrarySearchItem[] | null = null;

function getLibrarySearchItems(): readonly LibrarySearchItem[] {
  if (cachedItems) return cachedItems;
  cachedItems = Object.values(NODE_REGISTRY)
    .filter((meta) => isInspectableNode(meta.kind))
    .map((meta) => {
      const tool = isIntegrationNodeKind(meta.kind) ? getIntegrationTool(meta.kind) : undefined;
      return {
        kind: meta.kind,
        label: tool?.label ?? meta.label,
        group: meta.group,
        groupLabel: getGroupLabel(meta.group),
        serviceLabel: tool?.serviceLabel,
        providerLabel: tool?.providerLabel,
        keywords: meta.keywords ?? [],
        description: tool?.description,
      };
    });
  return cachedItems;
}

let cachedFuse: Fuse<LibrarySearchItem> | null = null;

function getFuse(): Fuse<LibrarySearchItem> {
  if (!cachedFuse) {
    cachedFuse = new Fuse([...getLibrarySearchItems()], {
      keys: [
        { name: "label", weight: 1.0 },
        { name: "keywords", weight: 0.9 },
        { name: "serviceLabel", weight: 0.6 },
        { name: "providerLabel", weight: 0.5 },
        { name: "groupLabel", weight: 0.4 },
        { name: "description", weight: 0.3 },
      ],
      threshold: 0.4,
      ignoreLocation: true,
      includeScore: true,
    });
  }
  return cachedFuse;
}

function exactRank(query: string, item: LibrarySearchItem): number {
  const label = item.label.toLowerCase();
  if (item.keywords.some((k) => k.toLowerCase() === query) || label === query) return 0;
  if (label.startsWith(query)) return 1;
  return 2;
}

export function searchLibrary(query: string): LibrarySearchItem[] {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();

  return getFuse()
    .search(q)
    .map((result) => ({ ...result, rank: exactRank(lower, result.item) }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (a.score ?? 1) - (b.score ?? 1) ||
        a.item.label.localeCompare(b.item.label),
    )
    .map((r) => r.item);
}
