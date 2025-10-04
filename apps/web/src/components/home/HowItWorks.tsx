// TODO: This is currently a template placeholder, needs to be updated with the React Flow simulation once ready.

import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const steps = [
  {
    title: "Design the flow",
    description:
      "Drop services, triggers, and agents on the canvas. Rune handles orchestration and dependencies.",
  },
  {
    title: "Validate",
    description:
      "Simulate runs, inspect logs, and invite teammates to collaborate with built-in review flows.",
  },
  {
    title: "Deploy",
    description:
      "Publish to production with API keys, webhooks, and monitoring wired in automatically.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight">
          How Rune Works
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          A guided workflow builder backed by a modern automation stack.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((step, index) => (
          <Card
            key={step.title}
            className="flex flex-col gap-4 border-border/60 bg-card/70 p-6"
          >
            <Badge variant="outline" className="w-fit border-border/60">
              Step {index + 1}
            </Badge>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
