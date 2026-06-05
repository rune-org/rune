"use client";

import { memo, useState } from "react";
import { Inspector } from "./Inspector";
import { ScrybInterface } from "./ScrybInterface";
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
  workflowId?: number | null;
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
    prev.workflowId === next.workflowId &&
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
  const [isScrybOpen, setIsScrybOpen] = useState(false);
  const {
    workflowId,
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
      className="pointer-events-none absolute right-4 top-4 bottom-8 z-35 flex h-auto flex-col items-end justify-between gap-4"
    >
      <div className="pointer-events-auto flex min-h-0 items-start gap-2 overflow-visible">
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
            // When Scryb is open, shrink the max-height of the Inspector to avoid overlap
            // The Inspector handles internal scrolling via overflow-y-auto
            isScrybOpen ? "max-h-[40vh]" : "max-h-[calc(100vh-12rem)]",
          )}
        />
      </div>

      {/* Bottom: Scryb */}
      <div className="pointer-events-auto shrink-0">
        <ScrybInterface
          isOpen={isScrybOpen}
          onOpenChange={setIsScrybOpen}
          workflowId={workflowId}
        />
      </div>
    </div>
  );
}, areEqual);
