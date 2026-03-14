"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/toast";
import { GitCommit, CheckCircle, Clock, Loader2, RotateCcw, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { workflows } from "@/lib/api";
import { versionToGraph } from "@/lib/workflows";
import type { WorkflowVersionListItem } from "@/client/types.gen";
import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

interface VersionHistoryPanelProps {
  workflowId: number | null;
  onViewVersion: (
    snapshot: { nodes: CanvasNode[]; edges: Edge[]; versionNumber: number } | null,
  ) => void;
  onRestore: (versionId: number) => void;
  onRunVersion?: (versionId: number) => void;
  viewingVersionNumber?: number | null;
  disabled?: boolean;
}

function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}

export function VersionHistoryPanel({
  workflowId,
  onViewVersion,
  onRestore,
  onRunVersion,
  viewingVersionNumber,
  disabled = false,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<WorkflowVersionListItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingVersionId, setLoadingVersionId] = useState<number | null>(null);

  const loadVersions = useCallback(async () => {
    if (!workflowId) {
      setVersions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await workflows.listVersions(workflowId);
      if (response.data) {
        const items = [...response.data.data].sort((a, b) => b.version - a.version);
        setVersions(items);
      }
    } catch {
      toast.error("Failed to load version history");
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, loadVersions]);

  const handleSelectVersion = async (version: WorkflowVersionListItem) => {
    if (!workflowId) return;
    setLoadingVersionId(version.id);
    try {
      const response = await workflows.getVersion(workflowId, version.id);
      if (response.data) {
        const graph = versionToGraph(response.data.data);
        onViewVersion({
          nodes: graph.nodes as CanvasNode[],
          edges: graph.edges as Edge[],
          versionNumber: version.version,
        });
      }
    } catch {
      toast.error("Failed to load version");
    } finally {
      setLoadingVersionId(null);
    }
  };

  const handleReturnToCurrent = () => {
    onViewVersion(null);
  };

  const isViewingHistory = viewingVersionNumber != null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-muted/40 border-border/60 hover:bg-muted/60"
          disabled={disabled}
        >
          <GitCommit className="h-4 w-4" />
          Versions
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" sideOffset={8}>
        <div className="border-b border-border p-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Version History</h4>
          </div>
          {isViewingHistory && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-full gap-2"
              onClick={handleReturnToCurrent}
            >
              <Clock className="h-3 w-3" />
              Return to Current
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Loading versions...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="p-6 text-center">
              <GitCommit className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No versions yet.</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Save the workflow to create the first version.
              </p>
            </div>
          ) : (
            <div className="p-1">
              {versions.map((v) => {
                const isActive = viewingVersionNumber === v.version;
                const isLoadingThis = loadingVersionId === v.id;
                return (
                  <div
                    key={v.id}
                    className={cn(
                      "group rounded-md px-2 py-2 text-sm transition-colors cursor-pointer",
                      isActive ? "bg-muted/60 text-foreground" : "hover:bg-muted/40",
                    )}
                    onClick={() => handleSelectVersion(v)}
                  >
                    <div className="flex items-center gap-2">
                      {isLoadingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">v{v.version}</span>
                          {v.is_published && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-green-500">
                              <CheckCircle className="h-2.5 w-2.5" />
                              Published
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatRelativeTime(v.created_at)}</span>
                          {v.created_by && (
                            <>
                              <span>·</span>
                              <span className="truncate">{v.created_by.name}</span>
                            </>
                          )}
                        </div>
                        {v.message && (
                          <p className="mt-0.5 text-xs text-muted-foreground/80 truncate">
                            {v.message}
                          </p>
                        )}
                      </div>
                    </div>
                    {isActive && (
                      <div className="mt-2 flex gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestore(v.id);
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </Button>
                        {onRunVersion && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunVersion(v.id);
                            }}
                          >
                            <Play className="h-3 w-3" />
                            Run
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
