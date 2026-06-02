"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { canDeleteTemplate } from "@/lib/permissions";
import { listTemplates, listTemplateCategories, deleteTemplate } from "@/lib/api/templates";
import type {
  TemplateCategorySummary,
  TemplateScope,
  TemplateSort,
  TemplateSummary,
} from "@/client/types.gen";
import { CategoryChips } from "./CategoryChips";
import { TemplateCard } from "./TemplateCard";
import { TemplateDetailDialog } from "./TemplateDetailDialog";
import { useDebouncedValue } from "./useDebouncedValue";

type ScopeFilter = TemplateScope | "all";

const SCOPES: ReadonlyArray<{ value: ScopeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "official", label: "Official" },
  { value: "community", label: "Community" },
  { value: "personal", label: "Personal" },
];

const SORTS: ReadonlyArray<{ value: TemplateSort; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "popular", label: "Most used" },
  { value: "newest", label: "Newest" },
  { value: "alphabetical", label: "A → Z" },
];

const EMPTY_HINTS: Record<ScopeFilter, string> = {
  all: "No templates match these filters. Try clearing the search or category.",
  official:
    "No official templates available yet. Check back after the next rune-templates release.",
  community:
    "No community templates here yet. Be the first - save a template and share it with your team.",
  personal:
    "You haven't saved any personal templates. Build a workflow in the canvas and save it as a template.",
};

export function TemplateGallery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state: authState } = useAuth();

  const currentUserId = authState.user?.id;
  const isAdmin = authState.user?.role === "admin";

  const initialScope = parseScope(searchParams.get("scope"));
  const initialCategory = searchParams.get("category");

  const [scope, setScope] = useState<ScopeFilter>(initialScope);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<TemplateSort>("featured");

  const debouncedSearch = useDebouncedValue(searchInput, 250);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [categories, setCategories] = useState<TemplateCategorySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [templateToDelete, setTemplateToDelete] = useState<TemplateSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("scope", scope);
    if (category) params.set("category", category);
    router.replace(`/create/templates?${params.toString()}`, { scroll: false });
  }, [scope, category, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTemplates({
      scope: scope === "all" ? undefined : scope,
      category: category ?? undefined,
      search: debouncedSearch || undefined,
      sort,
    })
      .then((response) => {
        if (cancelled) return;
        if (response.data && !response.error) {
          setTemplates(response.data.data);
        } else {
          toast.error("Failed to load templates");
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load templates");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scope, category, debouncedSearch, sort]);

  useEffect(() => {
    listTemplateCategories(scope === "all" ? undefined : scope)
      .then((response) => {
        if (response.data && !response.error) {
          setCategories(response.data.data);
        }
      })
      .catch(() => {
        // Counts are decoration; don't toast on failure.
      });
  }, [scope]);

  const totalCount = useMemo(() => categories.reduce((sum, c) => sum + c.count, 0), [categories]);

  const handleUse = useCallback(
    (template: TemplateSummary) => {
      router.push(`/create/app?templateId=${template.id}`);
    },
    [router],
  );

  const handleOpenDetail = useCallback((template: TemplateSummary) => {
    setSelectedTemplate(template);
    setDetailOpen(true);
  }, []);

  const canDelete = useCallback(
    (template: TemplateSummary) =>
      canDeleteTemplate(template.source, template.created_by, currentUserId, isAdmin),
    [currentUserId, isAdmin],
  );

  const handleRequestDelete = useCallback((template: TemplateSummary) => {
    setTemplateToDelete(template);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!templateToDelete) return false;
    setDeleting(true);
    try {
      const response = await deleteTemplate(templateToDelete.id);
      if (response.error) {
        toast.error("Failed to delete template");
        return false;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
      if (selectedTemplate?.id === templateToDelete.id) setDetailOpen(false);
      toast.success("Template deleted");
      setTemplateToDelete(null);
      return true;
    } catch {
      toast.error("Failed to delete template");
      return false;
    } finally {
      setDeleting(false);
    }
  }, [templateToDelete, selectedTemplate]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Start your workflow from a curated template, a community-shared blueprint, or one of
            your own.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, description, or tag"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Select value={sort} onValueChange={(v) => setSort(v as TemplateSort)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <Tabs value={scope} onValueChange={(v) => setScope(v as ScopeFilter)}>
        <TabsList>
          {SCOPES.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <CategoryChips
        categories={categories}
        selected={category}
        onChange={setCategory}
        totalCount={totalCount}
      />

      {loading ? (
        <LoadingGrid />
      ) : templates.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {debouncedSearch || category
                ? "No templates match these filters"
                : "Nothing here yet"}
            </EmptyTitle>
            <EmptyDescription>
              {debouncedSearch || category
                ? "Try a different category, clear your search, or browse another tab."
                : EMPTY_HINTS[scope]}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onOpenDetail={handleOpenDetail}
              onUse={handleUse}
              canDelete={canDelete(template)}
              onDelete={handleRequestDelete}
            />
          ))}
        </div>
      )}

      <TemplateDetailDialog
        template={selectedTemplate}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUse={(t) => {
          setDetailOpen(false);
          handleUse(t);
        }}
        canDelete={selectedTemplate ? canDelete(selectedTemplate) : false}
        onDelete={handleRequestDelete}
      />

      <ConfirmationDialog
        open={templateToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setTemplateToDelete(null);
        }}
        title="Delete template"
        description={
          <>
            This will permanently delete the template{" "}
            <span className="font-semibold">{templateToDelete?.name ?? "Untitled"}</span>. This
            action cannot be undone.
          </>
        }
        cancelText="Cancel"
        confirmText={deleting ? "Deleting..." : "Delete"}
        onConfirm={handleConfirmDelete}
        isDangerous
        isLoading={deleting}
      />
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-lg border border-input bg-muted/30" />
      ))}
    </div>
  );
}

function parseScope(raw: string | null): ScopeFilter {
  if (raw === "community" || raw === "personal" || raw === "official" || raw === "all") return raw;
  return "all";
}
