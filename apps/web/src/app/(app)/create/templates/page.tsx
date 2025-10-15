import Link from "next/link";

import { ArrowUpRightIcon, LayoutGrid } from "lucide-react";

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

export default function CreateTemplatesPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Templates"
        description="Browse reusable templates to jumpstart your next workflow."
      />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutGrid className="h-6 w-6" aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Template gallery in progress</EmptyTitle>
          <EmptyDescription>
            We&apos;re assembling a curated library of workflow blueprints to
            help you launch faster.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/create/app">Build from scratch</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/create/docs">See starter guides</Link>
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
            Learn how templates work{" "}
            <ArrowUpRightIcon className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </Empty>
    </Container>
  );
}
