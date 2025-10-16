import Link from "next/link";

import { ArrowUpRightIcon, UserRound } from "lucide-react";

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

export default function ProfilePage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-4xl">
      <PageHeader
        title="Profile"
        description="Manage your profile details and account security."
      />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRound className="h-6 w-6" aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Profile editor coming soon</EmptyTitle>
          <EmptyDescription>
            Update your personal details, password, and security preferences as
            soon as these controls are enabled.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button disabled title="Profile updates are not yet available">
              Edit profile
            </Button>
            <Button variant="outline" asChild>
              <Link href="/settings">Review workspace settings</Link>
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
            Read account management docs{" "}
            <ArrowUpRightIcon className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </Empty>
    </Container>
  );
}
