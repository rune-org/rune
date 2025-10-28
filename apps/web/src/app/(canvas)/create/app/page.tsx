"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";

import FlowCanvas from "@/features/canvas/FlowCanvas";
import { ApiMock } from "@/lib/api-mock";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/types";
import { sanitizeGraph } from "@/features/canvas/lib/graphIO";

function CanvasPageInner() {
  const params = useSearchParams();
  const workflowId = params.get("workflow"); // This would be the workflow ID passed as a query parameter
  const templateId = params.get("templateId"); // Check if loading from template

  const [nodes, setNodes] = useState<CanvasNode[] | undefined>(undefined);
  const [edges, setEdges] = useState<CanvasEdge[] | undefined>(undefined);

  useEffect(() => {
    const abortController = new AbortController();
    
    async function load() {
      // Check if loading from template
      if (templateId) {
        try {
          const { applyTemplate } = await import("@/lib/api/templates");
          
          // Check if aborted before making the API call
          if (abortController.signal.aborted) return;
          
          const response = await applyTemplate(Number(templateId));
          
          // Check if aborted after API call
          if (abortController.signal.aborted) return;
          
          if (response.data && !response.error) {
            const workflowData = response.data.data.workflow_data as { nodes: RFNode[]; edges: RFEdge[] };
            const { nodes: filteredNodes, edges: filteredEdges } =
              sanitizeGraph(workflowData);
            setNodes(filteredNodes as unknown as CanvasNode[]);
            setEdges(filteredEdges as unknown as CanvasEdge[]);
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error("Failed to load template data:", error);
          }
        }
        return;
      }

      if (!workflowId) {
        setNodes(undefined);
        setEdges(undefined);
        return;
      }
      
      if (abortController.signal.aborted) return;
      
      const graph = await ApiMock.getWorkflowGraph(workflowId);
      
      if (abortController.signal.aborted) return;
      
      const { nodes: filteredNodes, edges: filteredEdges } =
        sanitizeGraph(graph);
      setNodes(filteredNodes as unknown as CanvasNode[]);
      setEdges(filteredEdges as unknown as CanvasEdge[]);
    }
    load();
    return () => {
      abortController.abort();
    };
  }, [workflowId, templateId]);

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
