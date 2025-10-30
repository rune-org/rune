"use client";

import Image from "next/image";
import { useEffect, useState, Suspense } from "react";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Mail,
  BarChart,
  Code,
  Cloud,
  Calendar,
  Share2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { listTemplates } from "@/lib/api/templates";
import type { TemplateSummary } from "@/client/types.gen";
import { useRouter, useSearchParams } from "next/navigation";

function TemplatesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Get category from URL params
  const selectedCategory = searchParams.get("category");

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await listTemplates();
        if (response.data && !response.error) {
          setTemplates(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  const handleUseTemplate = async (templateId: number) => {
    // Navigate to canvas with template ID in URL
    router.push(`/create/app?templateId=${templateId}`);
  };

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, TemplateSummary[]>);

  // Get recently used templates (for now, just show the first one)
  const recentlyUsed = templates.length > 0 ? [templates[0]] : [];

  // Get trending templates - ALWAYS top 4 from ALL categories
  const trendingTemplates = [...templates]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 4);

  const categories = Object.keys(templatesByCategory);

  // Get templates for selected category
  const categoryTemplates = selectedCategory
    ? selectedCategory === "all"
      ? templates
      : templates.filter((t) => t.category === selectedCategory)
    : [];

  // Get category name and display it in a user-friendly way
  const getCategoryDisplayName = (categoryName: string) => {
    const categoryMap: Record<string, string> = {
      email: "Email",
      analytics: "Analytics",
      development: "Development",
      cloud: "Cloud",
      scheduling: "Scheduling",
      social_media: "Social Media",
      all: "All Templates",
    };
    return categoryMap[categoryName] || categoryName;
  };
  if (loading) {
    return (
      <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
        <PageHeader title="Templates" />
        <div className="text-center text-muted-foreground">Loading templates...</div>
      </Container>
    );
  }

  // If a category is selected, show the category view
  if (selectedCategory) {
    return (
      <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/create/templates")}
            className="gap-2"
          >
            ← Back
          </Button>
          <PageHeader title={getCategoryDisplayName(selectedCategory)} />
        </div>

        {categoryTemplates.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categoryTemplates.map((template) => (
              <Card
                key={template.id}
                className="transition-colors hover:border-accent/50 hover:bg-accent/10"
              >
                <CardContent className="flex flex-col p-5">
                  <CardTitle className="mb-1 text-base font-semibold">{template.name}</CardTitle>
                  <CardDescription className="mb-4 text-sm">
                    {template.description}
                  </CardDescription>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Create from template
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUseTemplate(template.id)}
                    >
                      Use
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No templates found
          </div>
        )}
      </Container>
    );
  }

  // Default view - show recently used, trending, and category buttons
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader title="Templates" />

      {/* Recently Used */}
      {recentlyUsed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm text-muted-foreground">Recently Used</h2>

          {recentlyUsed.map((template) => (
            <div
              key={template.id}
              className="inline-flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer"
              onClick={() => handleUseTemplate(template.id)}
            >
              {/* TODO(fe): Use actual template icon when available */}
              <Image src="/icons/social/email.svg" alt="template" width={20} height={20} /> 
              <span className="text-sm">{template.name}</span>
            </div>
          ))}
        </section>
      )}

      <hr className="border-border/60" />

      {/* Trending Templates */}
      <section className="space-y-4">
        <h2 className="text-sm text-muted-foreground">Trending Templates</h2>

        {trendingTemplates.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {trendingTemplates.map((template) => (
              <Card key={template.id} className="transition-colors hover:border-accent/50 hover:bg-accent/10">
                <CardContent className="flex flex-col p-5">
                  <CardTitle className="mb-1 text-base font-semibold">{template.name}</CardTitle>
                  <CardDescription className="mb-4 text-sm">
                    {template.description}
                  </CardDescription>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Create from template
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUseTemplate(template.id)}
                    >
                      Use
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No trending templates available yet
          </div>
        )}
      </section>

      <hr className="border-border/60" />

      {/* Browse by Category */}
      <section className="space-y-4">
        <h2 className="text-sm text-muted-foreground">Browse by Category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* Static category icons mapping */}
          {[
            { name: "email", icon: <Mail size={16} />, displayName: "Email" },
            { name: "analytics", icon: <BarChart size={16} />, displayName: "Analytics" },
            { name: "development", icon: <Code size={16} />, displayName: "Development" },
            { name: "cloud", icon: <Cloud size={16} />, displayName: "Cloud" },
            { name: "scheduling", icon: <Calendar size={16} />, displayName: "Scheduling" },
            { name: "social_media", icon: <Share2 size={16} />, displayName: "Social Media" },
          ]
            .filter((cat) => categories.includes(cat.name))
            .concat([{ name: "all", icon: <FileText size={16} />, displayName: "All Templates" }])
            .map((cat, i) => (
              <div
                key={i}
                onClick={() => router.push(`/create/templates?category=${cat.name}`)}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-accent/10 cursor-pointer"
              >
                <div className="rounded-md bg-background/70 p-1.5">{cat.icon}</div>
                <span className="text-sm">{cat.displayName}</span>
              </div>
            ))}
        </div>
      </section>

      {/* Create New Template */}
      <div className="mt-2 flex justify-center">
        <Button size="lg" onClick={() => router.push("/create/app")}>
          + Create New Template
        </Button>
      </div>
    </Container>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
          <PageHeader title="Templates" />
          <div className="text-center text-muted-foreground">Loading templates...</div>
        </Container>
      }
    >
      <TemplatesPageInner />
    </Suspense>
  );
}
