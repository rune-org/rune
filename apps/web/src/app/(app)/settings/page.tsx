import Link from "next/link";

import { ArrowUpRightIcon, Settings2 } from "lucide-react";

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

export default function SettingsPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-4xl">
      <PageHeader
        title="Settings"
        description="Configure workspace preferences and integrations."
      />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Settings2 className="h-6 w-6" aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Workspace settings are under construction</EmptyTitle>
          <EmptyDescription>
            We&apos;re finishing the controls for managing environments,
            integrations, and permissions.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button disabled title="Settings will be available soon">
              Configure workspace
            </Button>
            <Button variant="outline" asChild>
              <Link href="/create/docs">Explore integration docs</Link>
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
            See what&apos;s coming next{" "}
            <ArrowUpRightIcon className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </Empty>
    </Container>
  );
}
