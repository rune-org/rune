"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Compass, Zap } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { workflows } from "@/lib/api";
import { useAppState } from "@/lib/state";

export default function SmithQuickstartPage() {
  const router = useRouter();
  const {
    actions: { refreshWorkflows },
  } = useAppState();

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [smithReply, setSmithReply] = useState<string | null>(null);
  const [smithTrace, setSmithTrace] = useState<string[] | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    let workflowId: number | null = null;
    try {
      const workflowName = name.trim() || "Smith Workflow";

      // 1) Create an empty workflow first so it exists in the list
      const createResponse = await workflows.createWorkflow({
        name: workflowName,
        description: "",
        workflow_data: {},
      });
      setSmithReply("Smith will open in the canvas to build your workflow.");
      setSmithTrace(null);
      workflowId =
        (createResponse.data as { data?: { id?: number } } | undefined)?.data
          ?.id ?? null;
      if (!workflowId) {
        throw new Error("Workflow was not created (missing id).");
      }

      // 2) Stash the Smith prompt + options for the canvas to consume
      try {
        localStorage.setItem(`smith-prompt-${workflowId}`, prompt.trim());
        localStorage.setItem(
          `smith-show-trace-${workflowId}`,
          showTrace ? "true" : "false",
        );
      } catch {
        // non-fatal
      }

      void refreshWorkflows();
      toast.success("Workflow created. Opening canvas with Smith.");
      router.push(`/create/app?workflow=${workflowId}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Smith couldn't create the workflow right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container className="py-12" widthClassName="max-w-6xl">
      <div className="mb-10 flex flex-col gap-4">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
          <Sparkles className="h-4 w-4" />
          Smith Quickstart
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Describe it, Smith builds it.
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground">
            Start with an idea and Smith will generate a wired workflow, auto-laid out and ready on the canvas.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <Card className="border border-border/70 bg-card/90 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl">Tell Smith what to build</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="workflow-name">Workflow name</Label>
                <Input
                  id="workflow-name"
                  placeholder="Customer onboarding flow"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workflow-prompt">What should happen?</Label>
                <Textarea
                  id="workflow-prompt"
                  placeholder="e.g. Trigger manually, hit the status API, branch on non-200 to send an email alert."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[180px]"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showTrace}
                  onChange={(e) => setShowTrace(e.target.checked)}
                  className="h-4 w-4 rounded border-border/70 text-primary focus-visible:outline-none"
                />
                Include reasoning (may be slower)
              </label>

              {smithReply && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
                  <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Smith says
                  </div>
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {smithReply}
                  </div>
                  {smithTrace && smithTrace.length > 0 && (
                    <details className="mt-3 rounded-md border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-semibold text-foreground">
                        View reasoning
                      </summary>
                      <div className="mt-2 max-h-48 overflow-y-auto rounded-md bg-background/80 p-2">
                        <ul className="space-y-1 pl-4">
                          {smithTrace.map((line, idx) => (
                            <li key={`${line}-${idx}`}>{idx + 1}. {line}</li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !prompt.trim()}
                className="inline-flex items-center gap-2"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Zap className="h-4 w-4 animate-pulse" />
                    Building with Smith...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Let Smith build it
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border border-border/70 bg-gradient-to-br from-background to-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Compass className="h-4 w-4 text-primary" />
                How this works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                Smith generates a workflow using the same tools as the canvas, then auto-layout runs so it opens cleanly.
              </div>
              <ul className="space-y-2">
                <li>• Include triggers, HTTP steps, branches, or email in plain language.</li>
                <li>• We auto-save the result and take you straight to the canvas.</li>
                <li>• You can keep editing with Smith from the Sparkles button on the canvas.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
