"use client";

import { useState } from "react";
import { Globe2, User2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { createTemplate } from "@/lib/api/templates";
import type { TemplateCategory, WorkflowGraph } from "@/client/types.gen";
import { stripCredentials } from "../lib/graphIO";
import { TEMPLATE_CATEGORIES } from "../lib/templateCategories";
import { TagsInput } from "./TagsInput";
import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

type SaveTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowData: { nodes: CanvasNode[]; edges: Edge[] };
};

type Visibility = "personal" | "community";

const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: Visibility;
  label: string;
  description: string;
  icon: typeof User2;
}> = [
  {
    value: "personal",
    label: "Personal",
    description: "Only you can see this template.",
    icon: User2,
  },
  {
    value: "community",
    label: "Community",
    description: "Visible to everyone on this Rune instance.",
    icon: Globe2,
  },
];

export function SaveTemplateDialog({ open, onOpenChange, workflowData }: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("general");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("personal");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setCategory("general");
    setTags([]);
    setVisibility("personal");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setSaving(true);
    try {
      const sanitizedWorkflowData = stripCredentials(workflowData);
      const response = await createTemplate({
        name: name.trim(),
        description: description.trim(),
        category,
        // Canvas RFGraph and WorkflowGraph are structurally compatible at
        // runtime; the cast bridges optional ``type`` on RFNode and required
        // ``type`` on WorkflowNode (every node on the canvas has a type set).
        workflow_data: sanitizedWorkflowData as unknown as WorkflowGraph,
        tags,
        is_public: visibility === "community",
      });

      if (response.error) {
        toast.error("Failed to save template");
        return;
      }

      toast.success("Template saved");
      onOpenChange(false);
      reset();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save the current canvas as a reusable template you can apply later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              placeholder="Gmail to Slack digest"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              placeholder="Describe what this template does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as TemplateCategory)}
            >
              <SelectTrigger id="template-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-tags">Tags</Label>
            <TagsInput id="template-tags" value={tags} onChange={setTags} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              {VISIBILITY_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = visibility === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setVisibility(option.value)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-input hover:border-muted-foreground/40",
                    )}
                    aria-pressed={active}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
