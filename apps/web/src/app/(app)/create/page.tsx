"use client";

import { useCallback, useEffect, useState } from "react";
import { Container } from "@/components/shared/Container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Info, Send, Wand2, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { listTemplates } from "@/lib/api/templates";
import { listWorkflows, listUserExecutions } from "@/lib/api/workflows";
import type { ExecutionListItem, TemplateSummary, WorkflowListItem } from "@/client/types.gen";
import { cn } from "@/lib/cn";
import { startSmithWithPrompt } from "@/lib/smith";
import { TemplateCard } from "./templates/_components/TemplateCard";
import { TemplateDetailDialog } from "./templates/_components/TemplateDetailDialog";

const POPULAR_LIMIT = 6;
const RECENT_LIMIT = 4;

const creationOptions = [
  {
    id: "scratch",
    title: "Start from Scratch",
    description: "Build a custom workflow from the ground up",
    icon: "/icons/StartFromScratchIcon.svg",
    action: "Create New",
    href: "/create/app",
  },
  {
    id: "template",
    title: "Use a Template",
    description: "Choose from pre-built workflow templates",
    icon: "/icons/UseTemplateIcon.svg",
    action: "Browse Templates",
    href: "/create/templates",
  },
  {
    id: "agent",
    title: "Ask an Agent",
    description: "Let AI help you build your workflow",
    icon: "/icons/AskAgentIcon.svg",
    action: "Start with Smith",
    href: "/create/smith",
  },
];

export default function CreatePage() {
  const router = useRouter();

  const [popularTemplates, setPopularTemplates] = useState<TemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowListItem[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingTemplates(true);
    listTemplates({ sort: "featured" })
      .then((response) => {
        if (cancelled) return;
        if (response.data && !response.error) {
          setPopularTemplates(response.data.data.slice(0, POPULAR_LIMIT));
        }
      })
      .catch(() => {
        // Popular templates are a teaser; fail quietly and hide the section.
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingWorkflows(true);
    Promise.all([listWorkflows(), listUserExecutions()])
      .then(([workflowsRes, executionsRes]) => {
        if (cancelled) return;
        const workflowData = workflowsRes.data?.data;
        const items: WorkflowListItem[] = Array.isArray(workflowData)
          ? workflowData
          : (workflowData?.items ?? []);
        const executionData = executionsRes.data?.data;
        const executions: ExecutionListItem[] = Array.isArray(executionData)
          ? executionData
          : (executionData?.items ?? []);

        setRecentWorkflows(orderByRecentRun(items, executions).slice(0, RECENT_LIMIT));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingWorkflows(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUse = useCallback(
    (template: TemplateSummary) => {
      router.push(`/create/app?templateId=${template.id}`);
    },
    [router],
  );

  const handleOpenWorkflow = useCallback(
    (workflowId: number) => {
      router.push(`/create/app?workflow=${workflowId}`);
    },
    [router],
  );

  const handleOpenDetail = useCallback((template: TemplateSummary) => {
    setSelectedTemplate(template);
    setDetailOpen(true);
  }, []);

  return (
    <Container className="flex flex-col gap-12 py-12" widthClassName="max-w-6xl">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Build your next workflow.</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Pick a starting point, you&apos;ll be running in minutes.
        </p>
      </div>

      {/* Creation Options */}
      <div className="grid gap-6 md:grid-cols-3">
        {creationOptions.map((option) => {
          return (
            <Card
              key={option.id}
              className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-200 hover:shadow-lg cursor-pointer"
              onClick={() => router.push(option.href)}
            >
              <CardHeader className="text-center pb-6">
                <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-2xl bg-primary/[6%] group-hover:bg-primary/[12%] dark:bg-primary/10 dark:group-hover:bg-primary/20 transition-colors">
                  <Image
                    src={option.icon}
                    alt={option.title}
                    width={80}
                    height={80}
                    className="brightness-[0.7] saturate-[2] dark:brightness-100 dark:saturate-100"
                  />
                </div>
                <CardTitle className="text-xl">{option.title}</CardTitle>
                <CardDescription className="text-sm whitespace-nowrap">
                  {option.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {loadingWorkflows ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: RECENT_LIMIT }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border border-input bg-muted/30"
            />
          ))}
        </div>
      ) : recentWorkflows.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Recent Workflows</h2>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => router.push("/create/workflows")}
            >
              View all workflows
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {recentWorkflows.map((workflow) => (
              <RecentWorkflowCard
                key={workflow.id}
                workflow={workflow}
                onOpen={handleOpenWorkflow}
              />
            ))}
          </div>
        </div>
      ) : (
        <SmithStarterBox />
      )}

      {(loadingTemplates || popularTemplates.length > 0) && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Popular Templates</h2>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => router.push("/create/templates")}
            >
              Browse all templates
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {loadingTemplates ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-lg border border-input bg-muted/30"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {popularTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onOpenDetail={handleOpenDetail}
                  onUse={handleUse}
                  canDelete={false}
                  onDelete={() => {}}
                />
              ))}
            </div>
          )}
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
        canDelete={false}
        onDelete={() => {}}
      />

      {/* Info Banner */}
      <Card className="border-muted/40 bg-muted/20">
        <CardContent className="flex items-center gap-3 p-6">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Don&apos;t worry, you can customize all template workflows to your services.
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}

function SmithStarterBox() {
  const [prompt, setPrompt] = useState("");

  const submit = () => startSmithWithPrompt(prompt);

  return (
    <Card className="relative overflow-hidden border-2 border-border/40 bg-gradient-to-br from-primary/[6%] via-background to-background">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Image
            src="/icons/smith_logo_white.svg"
            alt="Smith"
            width={120}
            height={30}
            className="h-7 w-auto invert dark:invert-0"
          />
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            AI agent
          </span>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Describe it,{" "}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
              Smith builds it.
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            No workflows yet? Tell Smith what you want to automate and it&apos;ll draft the first
            one for you.
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Wand2 className="h-4 w-4 text-primary/70" />
            What would you like to build?
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. When a Stripe payment over $1,000 comes in, alert my #vip-deals Slack channel."
            className="min-h-[90px] resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={submit} disabled={!prompt.trim()} className="group gap-2">
              Generate with Smith
              <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function orderByRecentRun(
  workflows: WorkflowListItem[],
  executions: ExecutionListItem[],
): WorkflowListItem[] {
  const lastRunAt = new Map<number, string>();
  for (const execution of executions) {
    const previous = lastRunAt.get(execution.workflow_id);
    if (!previous || execution.created_at > previous) {
      lastRunAt.set(execution.workflow_id, execution.created_at);
    }
  }

  const ran = workflows
    .filter((w) => lastRunAt.has(w.id))
    .sort((a, b) => lastRunAt.get(b.id)!.localeCompare(lastRunAt.get(a.id)!));
  const neverRan = workflows.filter((w) => !lastRunAt.has(w.id));

  return [...ran, ...neverRan];
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-300",
  inactive: "bg-muted text-muted-foreground border-border",
  draft: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
};

function RecentWorkflowCard({
  workflow,
  onOpen,
}: {
  workflow: WorkflowListItem;
  onOpen: (workflowId: number) => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(workflow.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(workflow.id);
        }
      }}
      className="group flex h-full cursor-pointer flex-col transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className="flex-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
            <Workflow className="h-4 w-4" />
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] capitalize",
              STATUS_TONE[workflow.status] ?? STATUS_TONE.inactive,
            )}
          >
            {workflow.status}
          </Badge>
        </div>
        <CardTitle className="line-clamp-1 text-base">{workflow.name}</CardTitle>
        <CardDescription className="line-clamp-2 text-xs">
          {workflow.description || "No description provided."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
