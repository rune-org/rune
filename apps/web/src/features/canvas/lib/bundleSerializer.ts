/**
 * Build a ``TemplateBundleEntry`` JSON document from a canvas graph + author
 * metadata, ready to be dropped into the ``rune-templates`` repo as a PR.
 *
 * The output mirrors the Pydantic ``TemplateBundleEntry`` schema in
 * ``services/api/src/templates/schemas.py`` and ``schema/template.schema.json``
 * in the ``rune-templates`` repo. Validation is intentionally left to CI in
 * that repo - keeping AJV out of the bundle saves ~70KB on first load.
 */
import { stripCredentials, stripExecutionStyling, type RFGraph } from "./graphIO";
import type { Edge as RFEdge, Node as RFNode } from "@xyflow/react";

export type BundleAuthor = {
  name: string;
  url?: string;
};

export type BundleMetadata = {
  name: string;
  description: string;
  category: string;
  icon?: string;
  tags: string[];
  author?: BundleAuthor;
  /** Override the auto-derived external_id slug. */
  externalIdOverride?: string;
};

export type TemplateBundleEntry = {
  external_id: string;
  name: string;
  description: string;
  category: string;
  icon: string | null;
  tags: string[];
  author: BundleAuthor | null;
  workflow_data: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
};

/**
 * Keys React Flow stamps onto nodes/edges at runtime. None of them are part
 * of the template contract - they'd just be noise in the committed JSON.
 */
const RUNTIME_NODE_KEYS = new Set([
  "selected",
  "dragging",
  "width",
  "height",
  "measured",
  "positionAbsolute",
  "resizing",
  "deletable",
  "draggable",
  "focusable",
  "selectable",
  "computed",
]);

const RUNTIME_EDGE_KEYS = new Set([
  "selected",
  "animated",
  "deletable",
  "focusable",
  "interactionWidth",
]);

function omitKeys<T extends Record<string, unknown>>(
  obj: T,
  keys: ReadonlySet<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

function sanitiseNode(node: RFNode): Record<string, unknown> {
  return omitKeys(node as unknown as Record<string, unknown>, RUNTIME_NODE_KEYS);
}

function sanitiseEdge(edge: RFEdge): Record<string, unknown> {
  return omitKeys(edge as unknown as Record<string, unknown>, RUNTIME_EDGE_KEYS);
}

/** Slugify a human name into a stable ``lower-kebab-case`` external_id. */
export function slugifyExternalId(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildBundleEntry(
  graph: RFGraph,
  meta: BundleMetadata,
): TemplateBundleEntry {
  // stripCredentials clears credential refs + webhook GUIDs from node.data.
  // stripExecutionStyling removes per-edge animated/style.stroke applied
  // during runs. Together they leave a graph that's safe to publish.
  const sanitisedGraph = stripExecutionStyling(stripCredentials(graph));

  const externalId =
    meta.externalIdOverride?.trim() || slugifyExternalId(meta.name);

  return {
    external_id: externalId,
    name: meta.name.trim(),
    description: meta.description.trim(),
    category: meta.category,
    icon: meta.icon?.trim() || null,
    tags: [...meta.tags],
    author: meta.author?.name.trim()
      ? {
          name: meta.author.name.trim(),
          ...(meta.author.url?.trim() ? { url: meta.author.url.trim() } : {}),
        }
      : null,
    workflow_data: {
      nodes: sanitisedGraph.nodes.map(sanitiseNode),
      edges: sanitisedGraph.edges.map(sanitiseEdge),
    },
  };
}

export function serialiseBundleEntry(entry: TemplateBundleEntry): string {
  return JSON.stringify(entry, null, 2) + "\n";
}
