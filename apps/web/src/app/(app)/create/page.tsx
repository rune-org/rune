import Link from "next/link";

import { ArrowUpRightIcon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";

export default function CreatePage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader title="Build your next workflow" />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles className="h-6 w-6" aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Creation tools are almost ready</EmptyTitle>
          <EmptyDescription>
            We&apos;re polishing the new workflow canvas. In the meantime you
            can review existing runs or explore what&apos;s possible.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/create/app">Open workflow builder</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/create/workflows">See saved workflows</Link>
            </Button>
          </div>
        </EmptyContent>
        <Button
          variant="link"
          asChild
          className="text-muted-foreground"
          size="sm"
        >
          <Link href="/create/docs">
            Browse the docs{" "}
            <ArrowUpRightIcon className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </Empty>
    </Container>
  );
}
