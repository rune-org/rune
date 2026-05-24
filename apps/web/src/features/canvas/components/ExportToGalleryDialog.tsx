"use client";

import { useMemo, useState } from "react";
import { Copy, Download, ExternalLink } from "lucide-react";
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
import { buildBundleEntry, serialiseBundleEntry, slugifyExternalId } from "../lib/bundleSerializer";
import { TEMPLATE_CATEGORIES } from "../lib/templateCategories";
import { TagsInput } from "./TagsInput";
import { IconPicker } from "@/components/templates/IconPicker";
import type { TemplateIconName } from "@/lib/templateIcons";
import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

type ExportToGalleryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowData: { nodes: CanvasNode[]; edges: Edge[] };
};

const GALLERY_REPO_URL = "https://github.com/rune-org/rune-templates";
const CONTRIBUTING_URL = `${GALLERY_REPO_URL}/blob/main/CONTRIBUTING.md`;

export function ExportToGalleryDialog({
  open,
  onOpenChange,
  workflowData,
}: ExportToGalleryDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [tags, setTags] = useState<string[]>([]);
  const [icon, setIcon] = useState<TemplateIconName | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [authorUrl, setAuthorUrl] = useState("");

  const externalId = useMemo(() => (name.trim() ? slugifyExternalId(name) : ""), [name]);

  const entry = useMemo(() => {
    if (!name.trim() || !externalId) return null;
    return buildBundleEntry(workflowData, {
      name,
      description,
      category,
      icon: icon ?? undefined,
      tags,
      author: authorName.trim()
        ? { name: authorName, url: authorUrl.trim() || undefined }
        : undefined,
    });
  }, [name, externalId, description, category, icon, tags, authorName, authorUrl, workflowData]);

  const serialised = useMemo(() => (entry ? serialiseBundleEntry(entry) : ""), [entry]);

  const filename = externalId ? `${externalId}.json` : "template.json";
  const targetPath = `templates/${
    category === "social_media" ? "social-media" : category
  }/${filename}`;

  const handleCopy = async () => {
    if (!serialised) return;
    try {
      await navigator.clipboard.writeText(serialised);
      toast.success("Copied template JSON to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleDownload = () => {
    if (!serialised) return;
    const blob = new Blob([serialised], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit to the global gallery</DialogTitle>
          <DialogDescription>
            Package this workflow as a template for the{" "}
            <a
              href={GALLERY_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              rune-templates
            </a>{" "}
            repo. Download the file and open a PR - once merged, every Rune instance will pick it up
            at next release.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="gallery-name"
              placeholder="Gmail to Slack daily digest"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {externalId && (
              <span className="text-xs text-muted-foreground">
                Slug: <code>{externalId}</code>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="gallery-category">
                <SelectValue />
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

          <div className="md:col-span-2 flex flex-col gap-2">
            <Label htmlFor="gallery-description">Description</Label>
            <Textarea
              id="gallery-description"
              placeholder="What does this workflow do? Who's it for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-tags">Tags</Label>
            <TagsInput id="gallery-tags" value={tags} onChange={setTags} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-author-name">Author name</Label>
            <Input
              id="gallery-author-name"
              placeholder="Your name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-author-url">Author URL</Label>
            <Input
              id="gallery-author-url"
              placeholder="https://github.com/you"
              value={authorUrl}
              onChange={(e) => setAuthorUrl(e.target.value)}
            />
          </div>
        </div>

        {entry && (
          <div className="rounded-md border border-input bg-muted/30 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium">Preview</span>
              <span className="text-muted-foreground">
                Drop into <code>{targetPath}</code>
              </span>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono">
              {serialised}
            </pre>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" asChild>
            <a href={CONTRIBUTING_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" />
              How to contribute
            </a>
          </Button>
          <Button variant="outline" onClick={handleCopy} disabled={!entry}>
            <Copy className="mr-1.5 h-4 w-4" />
            Copy JSON
          </Button>
          <Button onClick={handleDownload} disabled={!entry}>
            <Download className="mr-1.5 h-4 w-4" />
            Download {filename}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
