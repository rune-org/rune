"use client";

import { useMemo } from "react";
import Image from "next/image";
import type { NodeKind } from "../types";
import {
  getNodesByGroup,
  getAllGroups,
  getGroupLabel,
  getGroupIcon,
  getGroupIconSrc,
  getGroupColor,
  isIntegrationGroup,
  isInspectableNode,
  type NodeGroup,
} from "../lib/nodeRegistry";
import { getIntegrationTool, isIntegrationNodeKind } from "../integrations/helpers";
import { DraggableItem, NodeIcon } from "./DraggableItem";

export type LibraryTab = "runic" | "integrations";

type LibraryProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
  tab?: LibraryTab;
  shortcutsByKind?: Partial<Record<NodeKind, string>>;
  onAssignShortcut?: (kind: NodeKind, key: string | null) => void;
};

type GroupProps = {
  group: NodeGroup;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
  shortcutsByKind?: Partial<Record<NodeKind, string>>;
  onAssignShortcut?: (kind: NodeKind, key: string | null) => void;
};

type SortedNode = { kind: NodeKind; label: string };

// Sections holding more nodes than this start collapsed; lighter ones stay open
const COLLAPSE_THRESHOLD = 6;

const libraryNodesByGroup = new Map<NodeGroup, ReturnType<typeof getNodesByGroup>>();

function getLibraryNodesByGroup(group: NodeGroup) {
  let nodes = libraryNodesByGroup.get(group);
  if (!nodes) {
    nodes = getNodesByGroup(group).filter((m) => isInspectableNode(m.kind));
    libraryNodesByGroup.set(group, nodes);
  }
  return nodes;
}

function NodeList({
  nodes,
  containerRef,
  onAdd,
  shortcutsByKind,
  onAssignShortcut,
}: {
  nodes: SortedNode[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAdd: (type: NodeKind, x?: number, y?: number) => void;
  shortcutsByKind?: Partial<Record<NodeKind, string>>;
  onAssignShortcut?: (kind: NodeKind, key: string | null) => void;
}) {
  return (
    <div className="grid gap-2">
      {nodes.map((node) => (
        <DraggableItem
          key={node.kind}
          type={node.kind}
          label={node.label}
          containerRef={containerRef}
          onAdd={onAdd}
          shortcutKey={shortcutsByKind?.[node.kind]}
          onAssignShortcut={onAssignShortcut}
        />
      ))}
    </div>
  );
}

function Group({ group, containerRef, onAdd, shortcutsByKind, onAssignShortcut }: GroupProps) {
  const Icon = getGroupIcon(group);
  const iconSrc = getGroupIconSrc(group);
  const color = getGroupColor(group);
  const title = getGroupLabel(group);
  const isIntegration = isIntegrationGroup(group);

  const subgroups = useMemo(() => {
    if (!isIntegration) return null;
    const map = new Map<
      string,
      { label: string; iconSrc: string; color: string; nodes: SortedNode[] }
    >();
    for (const node of getLibraryNodesByGroup(group)) {
      if (!isIntegrationNodeKind(node.kind)) continue;
      const tool = getIntegrationTool(node.kind);
      if (!tool) continue;
      if (!map.has(tool.service)) {
        map.set(tool.service, {
          label: tool.serviceLabel,
          iconSrc: tool.icon,
          color: tool.colorTheme.base,
          nodes: [],
        });
      }
      map.get(tool.service)!.nodes.push(node);
    }
    for (const sg of map.values()) {
      sg.nodes.sort((a, b) => a.label.localeCompare(b.label));
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [isIntegration, group]);

  const flatNodes = useMemo(() => {
    if (isIntegration) return null;
    return [...getLibraryNodesByGroup(group)].sort((a, b) => a.label.localeCompare(b.label));
  }, [isIntegration, group]);

  const totalNodes = subgroups?.reduce((sum, sg) => sum + sg.nodes.length, 0) ?? 0;

  return (
    <details
      open={!isIntegration || totalNodes <= COLLAPSE_THRESHOLD}
      className="rounded-[calc(var(--radius)-0.35rem)] border p-2 backdrop-blur-sm"
      style={{
        borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 6%, transparent)`,
      }}
    >
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <NodeIcon iconSrc={iconSrc} Icon={Icon} className="h-3.5 w-3.5" />
        {title}
      </summary>
      <div className="mt-2 grid gap-2">
        {subgroups ? (
          subgroups.map((sg) => (
            <details
              key={sg.label}
              open={sg.nodes.length <= COLLAPSE_THRESHOLD}
              className="rounded-[calc(var(--radius)-0.4rem)] border p-1.5"
              style={{
                borderColor: `color-mix(in srgb, ${sg.color} 20%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${sg.color} 5%, transparent)`,
              }}
            >
              <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <Image
                  src={sg.iconSrc}
                  alt=""
                  width={12}
                  height={12}
                  className="h-3 w-3 shrink-0"
                  aria-hidden
                />
                {sg.label}
              </summary>
              <div className="mt-1.5">
                <NodeList
                  nodes={sg.nodes}
                  containerRef={containerRef}
                  onAdd={onAdd}
                  shortcutsByKind={shortcutsByKind}
                  onAssignShortcut={onAssignShortcut}
                />
              </div>
            </details>
          ))
        ) : (
          <NodeList
            nodes={flatNodes!}
            containerRef={containerRef}
            onAdd={onAdd}
            shortcutsByKind={shortcutsByKind}
            onAssignShortcut={onAssignShortcut}
          />
        )}
      </div>
    </details>
  );
}

export function LibraryGroups({
  containerRef,
  onAdd,
  tab,
  shortcutsByKind,
  onAssignShortcut,
}: LibraryProps) {
  const groups = useMemo(
    () =>
      getAllGroups().filter((g) => {
        if (tab === "runic" && isIntegrationGroup(g)) return false;
        if (tab === "integrations" && !isIntegrationGroup(g)) return false;
        return getLibraryNodesByGroup(g).length > 0;
      }),
    [tab],
  );

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <Group
          key={group}
          group={group}
          containerRef={containerRef}
          onAdd={onAdd}
          shortcutsByKind={shortcutsByKind}
          onAssignShortcut={onAssignShortcut}
        />
      ))}
    </div>
  );
}
