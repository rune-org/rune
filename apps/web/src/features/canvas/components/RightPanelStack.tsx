"use client";

import { memo } from "react";
import { Inspector } from "./Inspector";
import { SelectionModeButton } from "./SelectionModeButton";
import { StickyNoteButton } from "./StickyNoteButton";
import { cn } from "@/lib/cn";
import type { CanvasNode } from "../types";
import { useUpdateNodeData } from "../hooks/useUpdateNodeData";
import { isInspectableNode } from "../lib/nodeRegistry";

type RightPanelStackProps = {
  selectedNode: CanvasNode | null;
  updateSelectedNodeLabel: (value: string) => void;
  updateData: ReturnType<typeof useUpdateNodeData>;
  onDelete?: () => void;
  isExpandedDialogOpen?: boolean;
  setIsExpandedDialogOpen?: (open: boolean) => void;
  onTogglePin?: (nodeId: string) => void;
  notePlacementMode?: boolean;
  onToggleNotePlacement?: () => void;
  selectMode?: boolean;
  onToggleSelectMode?: () => void;
  isScrybOpen?: boolean;
  readOnly?: boolean;
};

function isEquivalentSelectedNode(prev: CanvasNode | null, next: CanvasNode | null) {
  if (prev === next) return true;
  if (!prev || !next) return false;

  return (
    prev.id === next.id &&
    prev.type === next.type &&
    prev.selected === next.selected &&
    prev.data === next.data
  );
}

function areEqual(prev: RightPanelStackProps, next: RightPanelStackProps) {
  return (
    prev.isScrybOpen === next.isScrybOpen &&
    prev.isExpandedDialogOpen === next.isExpandedDialogOpen &&
    prev.readOnly === next.readOnly &&
    prev.selectMode === next.selectMode &&
    prev.notePlacementMode === next.notePlacementMode &&
    Boolean(prev.onDelete) === Boolean(next.onDelete) &&
    Boolean(prev.onToggleNotePlacement) === Boolean(next.onToggleNotePlacement) &&
    Boolean(prev.onToggleSelectMode) === Boolean(next.onToggleSelectMode) &&
    isEquivalentSelectedNode(prev.selectedNode, next.selectedNode)
  );
}

export const RightPanelStack = memo(function RightPanelStack(props: RightPanelStackProps) {
  const {
    isScrybOpen,
    readOnly,
    notePlacementMode,
    onToggleNotePlacement,
    selectMode,
    onToggleSelectMode,
    ...inspectorProps
  } = props;

  const inspectorSelectedNode =
    inspectorProps.selectedNode && isInspectableNode(inspectorProps.selectedNode.type)
      ? inspectorProps.selectedNode
      : null;

  return (
    <div
      data-onboarding="inspector"
      className="pointer-events-auto ml-auto flex min-h-0 items-start gap-2 overflow-visible"
    >
      {!readOnly && onToggleSelectMode && (
        <SelectionModeButton active={Boolean(selectMode)} onToggle={onToggleSelectMode} />
      )}
      {!readOnly && onToggleNotePlacement && (
        <StickyNoteButton active={Boolean(notePlacementMode)} onClick={onToggleNotePlacement} />
      )}
      <Inspector
        {...inspectorProps}
        selectedNode={inspectorSelectedNode}
        readOnly={readOnly}
        renderInPanel={false}
        className={cn(
          "transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isScrybOpen ? "max-h-[40vh]" : "max-h-[calc(100vh-12rem)]",
        )}
      />
    </div>
  );
}, areEqual);
