"use client";

import { useState } from "react";
import { Panel } from "@xyflow/react";
import { Inspector } from "./Inspector";
import { ScrybInterface } from "./ScrybInterface";
import { cn } from "@/lib/cn";
import type { CanvasNode } from "../types";
import { useUpdateNodeData } from "../hooks/useUpdateNodeData";

type RightPanelStackProps = {
  selectedNode: CanvasNode | null;
  updateSelectedNodeLabel: (value: string) => void;
  updateData: ReturnType<typeof useUpdateNodeData>;
  onDelete?: () => void;
  isExpandedDialogOpen?: boolean;
  setIsExpandedDialogOpen?: (open: boolean) => void;
  onTogglePin?: (nodeId: string) => void;
  workflowId?: number | null;
};

export function RightPanelStack(props: RightPanelStackProps) {
  const [isScrybOpen, setIsScrybOpen] = useState(false);
  const { workflowId, ...inspectorProps } = props;

  return (
    <Panel 
      position="top-right" 
      className="pointer-events-none !right-4 !top-4 !bottom-8 !h-auto flex flex-col justify-between items-end gap-4 z-[60]"
    >
      {/* Top: Inspector */}
      <div className="pointer-events-auto min-h-0 flex flex-col items-end overflow-visible">
        <Inspector
          {...inspectorProps}
          renderInPanel={false}
          className={cn(
            "transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
            // When Scryb is open, shrink the max-height of the Inspector to avoid overlap
            // The Inspector handles internal scrolling via overflow-y-auto
            isScrybOpen ? "max-h-[40vh]" : "max-h-[calc(100vh-12rem)]"
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
    </Panel>
  );
}
