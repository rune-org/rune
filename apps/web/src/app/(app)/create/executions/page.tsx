import Link from "next/link";

import { Activity, ArrowUpRightIcon } from "lucide-react";

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

export default function CreateExecutionsPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Executions"
        description="Track workflow runs and inspect their outputs."
      />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Activity className="h-6 w-6" aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No executions yet</EmptyTitle>
          <EmptyDescription>
            Trigger a workflow to populate this activity view with run history,
            logs, and outputs.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/create/workflows">Run a workflow</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/create/docs">View run docs</Link>
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
            Learn about monitoring{" "}
            <ArrowUpRightIcon className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </Empty>
    </Container>
  );
}
