import Image from "next/image";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookOpen, KeyRound, LayoutGrid, Workflow } from "lucide-react";
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
    title: "Getting Started",
    description: "Spin up your first workflow in minutes with guided steps.",
    icon: BookOpen,
    href: "/docs/getting-started",
  },
  {
    title: "Workflows",
    description: "Design, test, and iterate on automated workflows.",
    icon: Workflow,
    href: "/docs/guides/creating-workflows",
  },
  {
    title: "Credentials",
    description: "Manage secure connections to external services and APIs.",
    icon: KeyRound,
    href: "/docs/guides/credentials",
  },
  {
    title: "Templates",
    description:
      "Reuse curated templates to launch faster with best practices.",
    icon: LayoutGrid,
    href: "/docs/guides/templates",
  },
  {
    title: "Smith AI",
    description:
      "Build workflows with natural language using the AI assistant.",
    image: "/icons/smith_logo_compact_white.svg",
    href: "/docs/guides/smith-ai",
  },
  {
    title: "Scryb AI",
    description:
      "Generate comprehensive documentation for any workflow with AI.",
    image: "/icons/scryb_logo_compact_white.svg",
    href: "/docs/guides/scryb-ai",
  },
];

const faqItems = [
  { question: "How do I install Rune?", href: "/docs/getting-started" },
  { question: "How can I create a workflow?", href: "/docs/guides/creating-workflows" },
  { question: "What workflow templates are available?", href: "/docs/guides/templates" },
  { question: "How does Smith AI build workflows?", href: "/docs/guides/smith-ai" },
  { question: "How does Scryb generate documentation?", href: "/docs/guides/scryb-ai" },
];

export default function CreateDocsPage() {
  return (
    <Container
      className="flex flex-col gap-10 py-12"
      widthClassName="max-w-6xl"
    >
      <PageHeader
        title="Documentation"
        description="Welcome to the Rune documentation. Learn how to create and manage your workflows."
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
                    <p className="mt-2 text-sm text-muted-foreground">
                      {card.description}
                    </p>
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
