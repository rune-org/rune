import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookOpen, KeyRound, LayoutGrid, Workflow } from "lucide-react";

const docCards = [
  {
    title: "Getting Started",
    description: "Spin up your first workflow in minutes with guided steps.",
    icon: BookOpen,
  },
  {
    title: "Workflows",
    description: "Design, test, and iterate on automated workflows.",
    icon: Workflow,
  },
  {
    title: "Credentials",
    description: "Manage secure connections to external services and APIs.",
    icon: KeyRound,
  },
  {
    title: "Templates",
    description:
      "Reuse curated templates to launch faster with best practices.",
    icon: LayoutGrid,
  },
];

const faqItems = [
  "How do I install Rune?",
  "How can I create a workflow?",
  "What workflow templates are available?",
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
            <Link key={card.title} href="/docs" className="group">
              <Card className="h-full border-border/40 bg-muted/20 transition-colors group-hover:border-accent/50 group-hover:bg-accent/10">
                <CardHeader className="flex flex-row items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/70 text-accent">
                    <Icon className="h-6 w-6" aria-hidden />
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
              key={item}
              href="/docs"
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="text-lg leading-none text-accent">+</span>
              {item}
            </Link>
          ))}
        </CardContent>
      </Card>
    </Container>
  );
}
