import Link from "next/link";

import { ArrowUpRightIcon, KeyRound } from "lucide-react";

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

export default function CreateCredentialsPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Credentials"
        description="Manage the keys and secrets your workflows need to run."
      />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRound className="h-6 w-6" aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Secure connections are on the way</EmptyTitle>
          <EmptyDescription>
            Soon you&apos;ll be able to store API keys and rotate secrets for
            every integration in your workspace.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button disabled title="Credential management is coming soon">
              Add credential
            </Button>
            <Button variant="outline" asChild>
              <Link href="/create/docs">Review integration guide</Link>
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
            Understand credential security{" "}
            <ArrowUpRightIcon className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </Empty>
    </Container>
  );
}
