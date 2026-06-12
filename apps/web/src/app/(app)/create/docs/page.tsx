import Image from "next/image";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Bot,
  BookOpen,
  CircleHelp,
  KeyRound,
  LayoutGrid,
  PlayCircle,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type DocCard = {
  title: string;
  description: string;
  href: string;
  icon?: LucideIcon;
  image?: string;
};

const docCards: DocCard[] = [
  {
    title: "Quick Start",
    description: "Build and run a no-credential workflow in a few minutes.",
    icon: PlayCircle,
    href: "/docs/getting-started/quick-start",
  },
  {
    title: "How Rune Works",
    description: "Learn workflows, triggers, nodes, credentials, and executions.",
    icon: BookOpen,
    href: "/docs/how-rune-works",
  },
  {
    title: "Workflows",
    description: "Create, save, run, and iterate on workflows in the canvas.",
    icon: Workflow,
    href: "/docs/guides/creating-workflows",
  },
  {
    title: "Credentials",
    description: "Connect private services without putting secrets in workflows.",
    icon: KeyRound,
    href: "/docs/guides/credentials",
  },
  {
    title: "Templates",
    description: "Start from reusable workflow patterns and customize safely.",
    icon: LayoutGrid,
    href: "/docs/guides/templates",
  },
  {
    title: "AI Features",
    description: "Use Smith to build workflows and Scryb to document them.",
    icon: Bot,
    href: "/docs/ai-features/smith-ai",
  },
  {
    title: "FAQ",
    description: "Answers for first-run blockers and common workflow questions.",
    icon: CircleHelp,
    href: "/docs/faq",
  },
];

const faqItems = [
  { question: "What should I do first?", href: "/docs/getting-started/quick-start" },
  { question: "How does Rune work?", href: "/docs/how-rune-works" },
  { question: "When do I need credentials?", href: "/docs/guides/credentials" },
  { question: "Why did my workflow fail?", href: "/docs/guides/executions" },
  { question: "How do Smith and Scryb help?", href: "/docs/ai-features/smith-ai" },
];

export default function CreateDocsPage() {
  return (
    <Container className="flex flex-col gap-10 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Documentation"
        description="Learn the core Rune workflow path: build, run, inspect, and improve."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/docs">Browse full docs</Link>
          </Button>
        }
      />

      <Card className="border border-border/40 bg-background/80">
        <CardContent className="pt-6">
          <Input
            type="search"
            placeholder="Search docs..."
            className="h-11 rounded-xl border-border/60 bg-background/80 text-base placeholder:text-muted-foreground"
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {docCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link key={card.title} href={card.href} className="group">
              <Card className="h-full border-border/40 bg-muted/20 transition-colors group-hover:border-accent/50 group-hover:bg-accent/10">
                <CardHeader className="flex flex-row items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/70 text-accent">
                    {card.image ? (
                      <Image
                        src={card.image}
                        alt={card.title}
                        width={28}
                        height={28}
                        className="h-7 w-7"
                        style={{
                          filter:
                            "brightness(0) saturate(100%) invert(46%) sepia(85%) saturate(1200%) hue-rotate(200deg) brightness(100%)",
                        }}
                      />
                    ) : Icon ? (
                      <Icon className="h-6 w-6" aria-hidden />
                    ) : null}
                  </span>
                  <div>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {card.title}
                    </CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="border border-border/40 bg-background/80">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqItems.map((item) => (
            <Link
              key={item.question}
              href={item.href}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="text-lg leading-none text-accent">+</span>
              {item.question}
            </Link>
          ))}
        </CardContent>
      </Card>
    </Container>
  );
}
