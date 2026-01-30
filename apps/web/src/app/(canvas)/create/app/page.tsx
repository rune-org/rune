"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";

import FlowCanvas from "@/features/canvas/FlowCanvas";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/types";
import { toast } from "@/components/ui/toast";
import { workflows } from "@/lib/api";
import { applyTemplate } from "@/lib/api/templates";
import {
  detailToGraph,
  graphToWorkflowData,
  defaultWorkflowSummary,
} from "@/lib/workflows";
import { sanitizeGraph } from "@/features/canvas/lib/graphIO";
import { useAppState } from "@/lib/state";
import { MissingNodeCredentialsError } from "@/lib/workflow-dsl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function CanvasPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const workflowId = params.get("workflow") ?? undefined;
  const templateId = params.get("templateId"); // Check if loading from template
  const {
    actions: { refreshWorkflows },
  } = useAppState();

  const [nodes, setNodes] = useState<CanvasNode[] | undefined>(undefined);
  const [edges, setEdges] = useState<CanvasEdge[] | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [draftGraph, setDraftGraph] = useState<{
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  } | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const numericWorkflowId = useMemo(() => {
    if (!workflowId) return null;
    const parsed = Number(workflowId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [workflowId]);

  useEffect(() => {
    const abortController = new AbortController();

    async function load() {
      // Check if loading from template
      if (templateId) {
        try {
          // Check if aborted before making the API call
          if (abortController.signal.aborted) return;

          const response = await applyTemplate(Number(templateId));

          // Check if aborted after API call
          if (abortController.signal.aborted) return;

          if (response.data && !response.error) {
            const workflowData = response.data.data.workflow_data as { nodes: RFNode[]; edges: RFEdge[] };
            const { nodes: filteredNodes, edges: filteredEdges } =
              sanitizeGraph(workflowData);
            if (!abortController.signal.aborted) {
              setNodes(filteredNodes as unknown as CanvasNode[]);
              setEdges(filteredEdges as unknown as CanvasEdge[]);
            }
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error("Failed to load template data:", error);
          }
        }
        return;
      }

      if (!workflowId) {
        if (!abortController.signal.aborted) {
          setNodes(undefined);
          setEdges(undefined);
        }
        return;
      }
      if (numericWorkflowId === null) {
        toast.error("Invalid workflow id.");
        if (!abortController.signal.aborted) {
          setNodes(undefined);
          setEdges(undefined);
        }
        return;
      }
      try {
        // Check if aborted before making the API call
        if (abortController.signal.aborted) return;

        const response = await workflows.getWorkflowById(numericWorkflowId);

        // Check if aborted after API call
        if (abortController.signal.aborted) return;
        if (!response.data) {
          throw new Error("Workflow not found");
        }
        const graph = detailToGraph(response.data.data);
        const parsed = sanitizeGraph({
          nodes: graph.nodes,
          edges: graph.edges,
        });
        const filteredNodes = parsed.nodes as CanvasNode[];
        const filteredEdges = parsed.edges as CanvasEdge[];

        if (!abortController.signal.aborted) {
          setNodes(filteredNodes);
          setEdges(filteredEdges);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load workflow",
          );
        }
      }
    }
    load();
    return () => {
      abortController.abort();
    };
  }, [workflowId, numericWorkflowId, templateId]);

  const handlePersist = useCallback(
    async (graph: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
      if (isSaving) return;

      if (numericWorkflowId !== null) {
        try {
          setIsSaving(true);
          const payload = graphToWorkflowData(graph);
          const response = await workflows.updateWorkflowData(
            numericWorkflowId,
            payload,
          );

          if (!response.data) {
            throw new Error("Failed to update workflow");
          }

          toast.success("Workflow updated");
        } catch (err) {
          if (err instanceof MissingNodeCredentialsError) {
            const nodeList = err.nodes
              .map((n) => `${n.type} (${n.id.slice(0, 6)})`)
              .join(", ");
            toast.error(`Missing credentials for: ${nodeList}`);
          } else {
            toast.error(
              err instanceof Error ? err.message : "Failed to update workflow",
            );
          }
        } finally {
          setIsSaving(false);
        }
        return;
      }

      setDraftGraph({
        nodes: graph.nodes,
        edges: graph.edges,
      });
      setCreateDialogOpen(true);
    },
    [isSaving, numericWorkflowId],
  );

  const handleCreateSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!draftGraph || isSaving) return;

      try {
        setIsSaving(true);
        const payload = graphToWorkflowData(draftGraph);

        const response = await workflows.createWorkflow({
          name: draftName.trim() || defaultWorkflowSummary.name,
          description: draftDescription.trim(),
          workflow_data: payload,
        });

        if (!response.data) {
          throw new Error("Failed to create workflow");
        }

        const created = response.data.data;
        toast.success("Workflow created");

        const graphFromDetail = detailToGraph(created);
        const sanitized = sanitizeGraph({
          nodes: graphFromDetail.nodes,
          edges: graphFromDetail.edges,
        });

        setNodes(sanitized.nodes as CanvasNode[]);
        setEdges(sanitized.edges as CanvasEdge[]);
        setDraftGraph(null);
        setDraftName("");
        setDraftDescription("");
        setCreateDialogOpen(false);
        void refreshWorkflows();
        router.replace(`/create/app?workflow=${created.id}`);
      } catch (err) {
        if (err instanceof MissingNodeCredentialsError) {
          const nodeList = err.nodes
            .map((n) => `${n.type} (${n.id.slice(0, 6)})`)
            .join(", ");
          toast.error(`Missing credentials for: ${nodeList}`);
        } else {
          toast.error(
            err instanceof Error ? err.message : "Failed to save workflow",
          );
        }
      } finally {
        setIsSaving(false);
      }
    },
    [
      draftGraph,
      draftName,
      draftDescription,
      refreshWorkflows,
      router,
      isSaving,
    ],
  );

  return (
    <div className="flex h-[100vh] flex-col">
      <div className="flex-1">
        <FlowCanvas
          externalNodes={nodes}
          externalEdges={edges}
          onPersist={handlePersist}
          saveDisabled={isSaving}
          workflowId={numericWorkflowId}
        />
      </div>

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!isSaving) {
            setCreateDialogOpen(open);
            if (!open) {
              setDraftGraph(null);
              setDraftName("");
              setDraftDescription("");
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save workflow</DialogTitle>
            <DialogDescription>
              Provide a name and optional description before we create the
              workflow.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleCreateSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="canvas-workflow-name">Name</Label>
              <Input
                id="canvas-workflow-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Untitled workflow"
                disabled={isSaving}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="canvas-workflow-description">Description</Label>
              <Textarea
                id="canvas-workflow-description"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                placeholder="What does this workflow do?"
                disabled={isSaving}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!isSaving) {
                    setCreateDialogOpen(false);
                    setDraftGraph(null);
                    setDraftName("");
                    setDraftDescription("");
                  }
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save workflow"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
