import Link from "next/link";

import { Button } from "@/components/ui/button";

import { WorkflowCard } from "./WorkflowCard";

const templates = [
  {
    from: "Email",
    to: "Slack",
    title: "Email → Slack Alert",
    description: "Send alerts to Slack channels based on email content.",
  },
  {
    from: "Weather",
    to: "Email",
    title: "Daily weather briefing",
    description: "Deliver local weather summaries to your inbox every morning.",
  },
  {
    from: "Calendar",
    to: "Planner",
    title: "Calendar → Planner",
    description:
      "Mirror events into your planning tool with metadata enrichment.",
  },
  {
    from: "RSS",
    to: "Discord",
    title: "RSS → Discord",
    description:
      "Automatically post new blog articles into your community server.",
  },
];

export function TemplateGrid() {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Popular workflows
          </h2>
          <p className="text-sm text-muted-foreground">
            Jumpstart with curated templates. Customize anything before
            deploying.
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/templates">View all templates</Link>
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {templates.map((template) => (
          <WorkflowCard key={template.title} {...template} />
        ))}
      </div>
    </section>
  );
}
