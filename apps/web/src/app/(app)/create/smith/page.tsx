"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Zap, Sparkles, ArrowRight, Quote } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

import { Container } from "@/components/shared/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { workflows } from "@/lib/api";
import { useAppState } from "@/lib/state";
import { cn } from "@/lib/cn";

const HINTS = [
  "Create a daily cron job that fetches user stats from the database and posts a summary to Slack if active users > 1000.",
  "When a webhook is received from Stripe, check if the payment failed. If so, send an email to the user; otherwise, grant access.",
  "Build an API endpoint that accepts a JSON payload, validates the schema, and inserts a record into the 'orders' table.",
  "Trigger on a new GitHub star, get the user's profile, and post a thank-you tweet using the Twitter API.",
  "Every hour, check the weather API. If it's raining, send a push notification to all subscribed devices.",
  "On form submission, verify the captcha. If valid, add the lead to Salesforce and send a notification to the sales team.",
];

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
  const [exampleHint, setExampleHint] = useState(HINTS[0]);

  useEffect(() => {
    setExampleHint(HINTS[Math.floor(Math.random() * HINTS.length)]);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    let workflowId: number | null = null;
    try {
      const workflowName = name.trim() || "Smith Workflow";

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
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-background via-background to-muted/30 selection:bg-primary/20">
      <div className="pointer-events-none absolute -right-[10%] top-0 h-[600px] w-[600px] rounded-full bg-indigo-500/5 blur-[120px]" />
      <div className="pointer-events-none absolute -left-[10%] bottom-0 h-[600px] w-[600px] rounded-full bg-pink-500/5 blur-[120px]" />

      <Container className="relative py-16 md:py-24" widthClassName="max-w-6xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-16 flex flex-col items-center text-center"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
            <Image
              src="/icons/smith_logo_white.svg"
              alt="Smith"
              width={220}
              height={54}
              className="relative h-14 w-auto"
              priority
            />
          </div>
          
          <h1 className="mb-6 max-w-3xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl lg:text-7xl">
            Describe it, <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            <br /> Smith builds it.</span>
          </h1>
          
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Turn your ideas into fully wired workflows instantly. Just describe what you need, and Smith handles the logic, connections, and layout.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="relative overflow-hidden border-border/50 bg-background/60 shadow-2xl backdrop-blur-xl transition-shadow hover:shadow-primary/5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              
              <CardContent className="p-8">
                <div className="mb-8 flex items-center gap-3 border-b border-border/40 pb-6">
                        <Sparkles className="h-9 w-9 mr-3" />
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight">Workflow Creator</h2>
                        <p className="text-sm text-muted-foreground">Tell Smith what you want to achieve</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2.5">
                    <Label htmlFor="workflow-name" className="text-sm font-medium text-foreground/80">
                        Workflow Name
                    </Label>
                    <Input
                      id="workflow-name"
                      placeholder="e.g., Customer Onboarding Flow"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 border-border/40 bg-muted/20 text-base transition-all focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="workflow-prompt" className="text-sm font-medium text-foreground/80">
                        Describe the logic
                    </Label>
                    <div className="relative">
                        <Textarea
                        id="workflow-prompt"
                        placeholder="Describe your workflow in plain English. For example: 'When a webhook is received, check if the user exists in the database. If they do, send a welcome email; otherwise, create a new record.'"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="min-h-[220px] resize-none border-border/40 bg-muted/20 p-4 text-base leading-relaxed transition-all focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10"
                        />
                        <div className="absolute bottom-4 right-4">
                            <label className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-lg border border-border/40 bg-background/80 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
                                showTrace ? "border-primary/30 text-primary" : "text-muted-foreground"
                            )}>
                                <input
                                type="checkbox"
                                checked={showTrace}
                                onChange={(e) => setShowTrace(e.target.checked)}
                                className="hidden"
                                />
                                <Sparkles className="h-3.5 w-3.5" />
                                {showTrace ? "Reasoning: On" : "Reasoning: Off"}
                            </label>
                        </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !prompt.trim()}
                    className="group h-14 w-full gap-2 bg-primary text-lg font-medium shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] hover:shadow-primary/30"
                  >
                    {isSubmitting ? (
                      <>
                        <Zap className="h-5 w-5 animate-pulse" />
                        Thinking...
                      </>
                    ) : (
                      <>
                        Generate Workflow
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 p-6 backdrop-blur-sm">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                    <Compass className="h-4 w-4 text-primary" />
                    How it works
                </h3>
                <ul className="space-y-4 text-sm text-muted-foreground">
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-[10px] font-bold text-primary">1</span>
                        <span>Describe your intent in natural language. Be as specific or general as you like.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-[10px] font-bold text-primary">2</span>
                        <span>Smith analyzes your request and constructs a complete workflow with nodes and edges.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-[10px] font-bold text-primary">3</span>
                        <span>The canvas opens with your workflow auto-arranged and ready for refinement.</span>
                    </li>
                </ul>
            </div>

            <div className="rounded-2xl border border-border/40 bg-card/40 p-6 backdrop-blur-sm">
                <Quote className="mb-4 h-5 w-5 text-primary/40" />
                <p className="text-sm italic leading-relaxed text-muted-foreground">
                    &quot;{exampleHint}&quot;
                </p>
            </div>
          </motion.div>
        </div>
      </Container>
    </div>
  );
}