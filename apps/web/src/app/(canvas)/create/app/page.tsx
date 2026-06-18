"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";

import FlowCanvas from "@/features/canvas/FlowCanvas";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/types";
import { toast } from "@/components/ui/toast";
import { workflows } from "@/lib/api";
import { applyTemplate } from "@/lib/api/templates";
import { detailToGraph, graphToWorkflowData, defaultWorkflowSummary } from "@/lib/workflows";
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

type WorkflowMeta = {
  publishedVersionId: number | null;
  hasUnpublishedChanges: boolean;
  latestVersionNumber: number | null;
};

function updateWorkflowMetaAfterSave(
  previous: WorkflowMeta | null,
  version: { id: number; version: number; is_published: boolean },
): WorkflowMeta {
  return {
    publishedVersionId: version.is_published ? version.id : (previous?.publishedVersionId ?? null),
    hasUnpublishedChanges: !version.is_published,
    latestVersionNumber: version.version,
  };
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.length > 0) {
      return detail;
    }
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

function getSaveErrorMessage(error: unknown): string {
  const message = getApiErrorMessage(error, "Failed to save workflow");
  if (message.toLowerCase().includes("insufficient permissions to edit this workflow")) {
    return "You no longer have editor access to this workflow.";
  }

  return message;
}

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
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [workflowName, setWorkflowName] = useState<string | null>(null);

  // Version state
  const [baseVersionId, setBaseVersionId] = useState<number | null>(null);
  const baseVersionIdRef = useRef<number | null>(null);
  const appliedTemplateRef = useRef<number | null>(null);
  // Set when Smith creates a workflow shell mid-session so the load() effect
  // below skips refetching it (the shell has no version yet — refetching would
  // push an empty graph and wipe Smith's in-progress canvas).
  const justCreatedRef = useRef<number | null>(null);
  useEffect(() => {
    baseVersionIdRef.current = baseVersionId;
  }, [baseVersionId]);
  const [workflowMeta, setWorkflowMeta] = useState<WorkflowMeta | null>(null);
  const [conflictData, setConflictData] = useState<{
    serverVersion: number;
    serverVersionId: number;
    localGraph: { nodes: CanvasNode[]; edges: CanvasEdge[] };
  } | null>(null);

  const numericWorkflowId = useMemo(() => {
    if (!workflowId) return null;
    const parsed = Number(workflowId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [workflowId]);

  useEffect(() => {
    const abortController = new AbortController();

    async function load() {
      if (templateId) {
        const numericTemplateId = Number(templateId);
        if (appliedTemplateRef.current === numericTemplateId) return;
        try {
          if (abortController.signal.aborted) return;

          const response = await applyTemplate(numericTemplateId);

          if (abortController.signal.aborted) return;

          if (response.data && !response.error) {
            const workflowData = response.data.data.workflow_data as {
              nodes: RFNode[];
              edges: RFEdge[];
            };
            const { nodes: filteredNodes, edges: filteredEdges } = sanitizeGraph(workflowData);
            if (!abortController.signal.aborted) {
              setNodes(filteredNodes as unknown as CanvasNode[]);
              setEdges(filteredEdges as unknown as CanvasEdge[]);
              appliedTemplateRef.current = numericTemplateId;
            }
          }
        } catch (_error) {
          // Silently fail if aborted (user navigated away)
        }
        return;
      }

      if (!workflowId) {
        if (!abortController.signal.aborted) {
          setNodes(undefined);
          setEdges(undefined);
          setBaseVersionId(null);
          setWorkflowMeta(null);
          setWorkflowName(null);
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
      if (numericWorkflowId === justCreatedRef.current) {
        // Just created for Smith; keep the live canvas instead of refetching an
        // empty shell. Subsequent saves persist versions normally.
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
        const detail = response.data.data;
        const graph = detailToGraph(detail);
        const parsed = sanitizeGraph({
          nodes: graph.nodes,
          edges: graph.edges,
        });
        const filteredNodes = parsed.nodes as CanvasNode[];
        const filteredEdges = parsed.edges as CanvasEdge[];

        if (!abortController.signal.aborted) {
          setNodes(filteredNodes);
          setEdges(filteredEdges);
          setBaseVersionId(detail.latest_version?.id ?? null);
          setWorkflowMeta({
            publishedVersionId: detail.published_version_id ?? null,
            hasUnpublishedChanges: detail.has_unpublished_changes ?? false,
            latestVersionNumber: detail.latest_version?.version ?? null,
          });
          setWorkflowName(detail.name);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          toast.error(err instanceof Error ? err.message : "Failed to load workflow");
        }
      }
    }
    load();
    return () => {
      abortController.abort();
    };
  }, [workflowId, numericWorkflowId, templateId]);

  const saveVersion = useCallback(
    async (graph: { nodes: CanvasNode[]; edges: CanvasEdge[] }, message?: string | null) => {
      if (!numericWorkflowId) return;
      setIsSaving(true);
      try {
        const payload = graphToWorkflowData(graph);
        const response = await workflows.createVersion(numericWorkflowId, {
          base_version_id: baseVersionIdRef.current,
          workflow_data: payload,
          message: message || null,
        });

        const newVersion = response.data!.data;
        const didCreateVersion = newVersion.id !== baseVersionIdRef.current;
        setBaseVersionId(newVersion.id);
        setWorkflowMeta((prev) => updateWorkflowMetaAfterSave(prev, newVersion));
        if (didCreateVersion) {
          toast.success("Version saved");
        }
        return newVersion.id;
      } catch (err) {
        const conflict = workflows.isVersionConflict(err);
        if (conflict) {
          setConflictData({
            serverVersion: conflict.serverVersion,
            serverVersionId: conflict.serverVersionId,
            localGraph: graph,
          });
        } else if (err instanceof MissingNodeCredentialsError) {
          const nodeList = err.nodes.map((n) => `${n.type} (${n.id.slice(0, 6)})`).join(", ");
          toast.error(`Missing credentials for: ${nodeList}`);
        } else {
          toast.error(getSaveErrorMessage(err));
        }
      } finally {
        setIsSaving(false);
      }

      return null;
    },
    [numericWorkflowId],
  );

  const handlePersist = useCallback(
    async (graph: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
      if (isSaving) return;

      if (numericWorkflowId !== null) {
        return await saveVersion(graph);
      }

      setDraftGraph({
        nodes: graph.nodes,
        edges: graph.edges,
      });
      setCreateDialogOpen(true);
      return null;
    },
    [isSaving, numericWorkflowId, saveVersion],
  );

  const handleSaveWithMessage = useCallback(
    async (graph: { nodes: CanvasNode[]; edges: CanvasEdge[] }, message: string) => {
      if (isSaving) return;
      if (numericWorkflowId !== null) {
        await saveVersion(graph, message);
        return;
      }
      // Workflow not yet created — store graph + message and open the create dialog
      setDraftGraph({ nodes: graph.nodes, edges: graph.edges });
      setDraftMessage(message);
      setCreateDialogOpen(true);
    },
    [isSaving, numericWorkflowId, saveVersion],
  );

  // Smith: ensure a real workflow exists (creating a silent shell when the
  // canvas has none yet) so the agent can edit and thread its conversation on a
  // real id. Returns the id, or null if creation failed.
  const ensureWorkflowForSmith = useCallback(async (): Promise<number | null> => {
    if (numericWorkflowId !== null) return numericWorkflowId;
    try {
      const response = await workflows.createWorkflow({
        name: defaultWorkflowSummary.name,
        description: "",
      });
      if (!response.data) {
        throw new Error("Failed to create workflow");
      }
      const created = response.data.data;
      justCreatedRef.current = created.id;
      setWorkflowName(created.name);
      setBaseVersionId(null);
      setWorkflowMeta({
        publishedVersionId: null,
        hasUnpublishedChanges: true,
        latestVersionNumber: null,
      });
      void refreshWorkflows();
      router.replace(`/create/app?workflow=${created.id}`);
      return created.id;
    } catch (err) {
      toast.error(getSaveErrorMessage(err));
      return null;
    }
  }, [numericWorkflowId, refreshWorkflows, router]);

  // Conflict resolution handlers
  const handleConflictLoadServer = useCallback(async () => {
    if (!conflictData || !numericWorkflowId) return;
    try {
      const response = await workflows.getVersion(numericWorkflowId, conflictData.serverVersionId);
      if (response.data) {
        const loadedVersion = response.data.data;
        const { versionToGraph } = await import("@/lib/workflows");
        const graph = versionToGraph(loadedVersion);
        const parsed = sanitizeGraph({ nodes: graph.nodes, edges: graph.edges });
        setNodes(parsed.nodes as CanvasNode[]);
        setEdges(parsed.edges as CanvasEdge[]);
        setBaseVersionId(conflictData.serverVersionId);
        setWorkflowMeta((prev) => ({
          publishedVersionId: loadedVersion.is_published
            ? loadedVersion.id
            : (prev?.publishedVersionId ?? null),
          hasUnpublishedChanges: !loadedVersion.is_published,
          latestVersionNumber: loadedVersion.version,
        }));
      }
    } catch {
      toast.error("Failed to load server version");
    }
    setConflictData(null);
  }, [conflictData, numericWorkflowId]);

  const handleConflictForceSave = useCallback(async () => {
    if (!conflictData || !numericWorkflowId) return;
    const localGraph = conflictData.localGraph;
    setConflictData(null);
    setIsSaving(true);
    try {
      const payload = graphToWorkflowData(localGraph);
      const response = await workflows.createVersion(numericWorkflowId, {
        base_version_id: conflictData.serverVersionId,
        workflow_data: payload,
      });

      const newVersion = response.data!.data;
      const didCreateVersion = newVersion.id !== conflictData.serverVersionId;
      setBaseVersionId(newVersion.id);
      setWorkflowMeta((prev) => updateWorkflowMetaAfterSave(prev, newVersion));
      if (didCreateVersion) {
        toast.success("Version saved");
      }
    } catch (err) {
      const nestedConflict = workflows.isVersionConflict(err);
      if (nestedConflict) {
        setConflictData({
          serverVersion: nestedConflict.serverVersion,
          serverVersionId: nestedConflict.serverVersionId,
          localGraph,
        });
      } else {
        toast.error(getSaveErrorMessage(err));
      }
    } finally {
      setIsSaving(false);
    }
  }, [conflictData, numericWorkflowId]);

  const handleConflictCancel = useCallback(() => {
    setConflictData(null);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!numericWorkflowId || !baseVersionIdRef.current) return;
    try {
      const response = await workflows.publishVersion(numericWorkflowId, baseVersionIdRef.current);
      const detail = response.data!.data;
      setWorkflowMeta({
        publishedVersionId: detail.published_version_id ?? null,
        hasUnpublishedChanges: detail.has_unpublished_changes ?? false,
        latestVersionNumber: detail.latest_version?.version ?? null,
      });
      toast.success("Version published");
      void refreshWorkflows();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to publish version"));
    }
  }, [numericWorkflowId, refreshWorkflows]);

  const handleRestore = useCallback(
    async (versionId: number) => {
      if (!numericWorkflowId) return;
      try {
        const response = await workflows.restoreVersion(numericWorkflowId, versionId);
        const { versionToGraph } = await import("@/lib/workflows");
        const newVersion = response.data!.data;
        const graph = versionToGraph(newVersion);
        const parsed = sanitizeGraph({ nodes: graph.nodes, edges: graph.edges });
        setNodes(parsed.nodes as CanvasNode[]);
        setEdges(parsed.edges as CanvasEdge[]);
        setBaseVersionId(newVersion.id);
        setWorkflowMeta((prev) => ({
          publishedVersionId: prev?.publishedVersionId ?? null,
          hasUnpublishedChanges: true,
          latestVersionNumber: newVersion.version,
        }));
        toast.success(`Restored to v${newVersion.version}`);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to restore version"));
      }
    },
    [numericWorkflowId],
  );

  const handleRunVersion = useCallback(
    async (versionId: number) => {
      if (!numericWorkflowId) return;
      try {
        await workflows.runWorkflow(numericWorkflowId, versionId);
        toast.success("Workflow queued for execution");
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to run version"));
      }
    },
    [numericWorkflowId],
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
        });

        if (!response.data) {
          throw new Error("Failed to create workflow");
        }

        const created = response.data.data;

        const versionResponse = await workflows.createVersion(created.id, {
          base_version_id: null,
          workflow_data: payload,
          message: draftMessage,
        });

        const newVersion = versionResponse.data!.data;
        const { versionToGraph } = await import("@/lib/workflows");
        const graph = versionToGraph(newVersion);
        const sanitized = sanitizeGraph({ nodes: graph.nodes, edges: graph.edges });
        setNodes(sanitized.nodes as CanvasNode[]);
        setEdges(sanitized.edges as CanvasEdge[]);
        setBaseVersionId(newVersion.id);
        setWorkflowMeta({
          publishedVersionId: null,
          hasUnpublishedChanges: true,
          latestVersionNumber: newVersion.version,
        });
        setWorkflowName(created.name);
        toast.success("Workflow created");
        setDraftGraph(null);
        setDraftMessage(null);
        setDraftName("");
        setDraftDescription("");
        setCreateDialogOpen(false);
        void refreshWorkflows();
        router.replace(`/create/app?workflow=${created.id}`);
      } catch (err) {
        if (err instanceof MissingNodeCredentialsError) {
          const nodeList = err.nodes.map((n) => `${n.type} (${n.id.slice(0, 6)})`).join(", ");
          toast.error(`Missing credentials for: ${nodeList}`);
        } else {
          toast.error(getSaveErrorMessage(err));
        }
      } finally {
        setIsSaving(false);
      }
    },
    [draftGraph, draftMessage, draftName, draftDescription, refreshWorkflows, router, isSaving],
  );

  return (
    <div className="flex h-[100vh] flex-col">
      <div className="flex-1">
        <FlowCanvas
          externalNodes={nodes}
          externalEdges={edges}
          onPersist={handlePersist}
          onSaveWithMessage={handleSaveWithMessage}
          saveDisabled={isSaving}
          workflowId={numericWorkflowId}
          workflowName={workflowName}
          onPublish={handlePublish}
          hasUnpublishedChanges={workflowMeta?.hasUnpublishedChanges ?? false}
          publishDisabled={!baseVersionId}
          onRestore={handleRestore}
          onRunVersion={handleRunVersion}
          conflictData={conflictData}
          onConflictLoadServer={handleConflictLoadServer}
          onConflictForceSave={handleConflictForceSave}
          onConflictCancel={handleConflictCancel}
          onEnsureWorkflow={ensureWorkflowForSmith}
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
              Provide a name and optional description before we create the workflow.
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
                {isSaving ? "Saving..." : "Save workflow"}
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
