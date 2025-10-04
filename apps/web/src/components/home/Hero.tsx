import Image from "next/image";
import Link from "next/link";

const workflowsIllustration = "/images/workflows.png";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared/Section";

export function Hero() {
  return (
    <Section>
      <div className="relative space-y-6">
        <div className="space-y-4">
          <h1 className="max-w-3xl font-display text-4xl leading-tight sm:text-5xl">
            Describe your workflow, <br /> Automate your world.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Rune gives every team a canvas, agents, and integrations to deliver
            powerful automation without writing boilerplate code.
          </p>
        </div>
        <Image
          src={workflowsIllustration}
          alt="Illustration of workflow automation"
          aria-hidden
          width={1000}
          height={1000}
          priority
          className="pointer-events-none select-none hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 w-48 sm:w-64 lg:w-80 xl:w-[22rem] object-contain"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/sign-up">Start building</Link>
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link
              href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch a demo
            </Link>
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-[var(--radius)] border border-border/60 bg-gradient-to-br from-primary/20 via-background to-secondary/40 p-8 shadow-[0_40px_80px_hsl(220_55%_6%/0.35)] mt-7">
        <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Flow Canvas
            </p>
            <p className="mt-2 font-medium text-foreground">
              Drag nodes onto the canvas to orchestrate any workflow.
            </p>
          </div>
          <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-card/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Version Control
            </p>
            <p className="mt-2 font-medium text-foreground">
              Ship confidently with built-in history, review flows, and test
              runs.
            </p>
          </div>
          <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-card/60 p-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Agent Collaboration
            </p>
            <p className="mt-2 font-medium text-foreground">
              Connect triggers, services, and agents side-by-side while Rune
              manages routing and guardrails.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
