"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { listTemplates, applyTemplate } from "@/lib/api/templates";
import type { TemplateSummary } from "@/client/types.gen";
import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

type ImportTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (workflowData: { nodes: CanvasNode[]; edges: Edge[] }) => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  email: "Email",
  analytics: "Analytics",
  development: "Development",
  cloud: "Cloud",
  scheduling: "Scheduling",
  social_media: "Social Media",
};

export function ImportTemplateDialog({
  open,
  onOpenChange,
  onSelect,
}: ImportTemplateDialogProps) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await listTemplates();
      if (response.data && !response.error) {
        setTemplates(response.data.data);
      }
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (templateId: number) => {
    setImporting(templateId);
    try {
      const response = await applyTemplate(templateId);
      if (response.data && !response.error) {
        const workflowData = response.data.data.workflow_data as {
          nodes: CanvasNode[];
          edges: Edge[];
        };
        onSelect(workflowData);
      } else {
        toast.error("Failed to load template");
      }
    } catch {
      toast.error("Failed to load template");
    } finally {
      setImporting(null);
    }
  };

  // Group templates by category
  const templatesByCategory = templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, TemplateSummary[]>,
  );


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Templates</DialogTitle>
          <DialogDescription>
            Choose a template to import into your canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No templates available
            </div>
          ) : (
            Object.entries(templatesByCategory).map(
              ([category, categoryTemplates]) => (
                <div key={category} className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[category] ?? category}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {categoryTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {template.name}
                          </span>
                          {template.description && (
                            <span className="text-xs text-muted-foreground">
                              {template.description}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelect(template.id)}
                          disabled={importing !== null}
                        >
                          {importing === template.id ? "Loading..." : "Use"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
