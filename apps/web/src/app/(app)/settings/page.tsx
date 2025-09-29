import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Container } from "@/components/shared/Container";

export default function SettingsPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-4xl">
      <PageHeader
        title="Settings"
        description="Configure workspace preferences and integrations."
      />
      <EmptyState
        title="Settings arriving soon"
        description="We'll unlock configuration options for your workspace here."
      />
    </Container>
  );
}
