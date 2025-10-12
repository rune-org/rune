"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import FlowCanvas from "@/features/canvas/FlowCanvas";
import { ApiMock } from "@/lib/api-mock";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/types";
import { sanitizeGraph } from "@/features/canvas/lib/graphIO";

function CanvasPageInner() {
  const params = useSearchParams();
  const workflowId = params.get("workflow"); // This would be the workflow ID passed as a query parameter

  const [nodes, setNodes] = useState<CanvasNode[] | undefined>(undefined);
  const [edges, setEdges] = useState<CanvasEdge[] | undefined>(undefined);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!workflowId) {
        setNodes(undefined);
        setEdges(undefined);
        return;
      }
      const graph = await ApiMock.getWorkflowGraph(workflowId);
      const { nodes: filteredNodes, edges: filteredEdges } =
        sanitizeGraph(graph);
      if (!ignore) {
        setNodes(filteredNodes as unknown as CanvasNode[]);
        setEdges(filteredEdges as unknown as CanvasEdge[]);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [workflowId]);

  return (
    <div className="flex h-[100vh] flex-col">
      <div className="flex-1">
        <FlowCanvas externalNodes={nodes} externalEdges={edges} />
      </div>
    </div>
  );
}

export default function CanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100vh] items-center justify-center text-sm text-muted-foreground">
          Loading workflow...
        </div>
      }
    >
      <CanvasPageInner />
    </Suspense>
  );
}
