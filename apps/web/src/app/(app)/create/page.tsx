import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";

export default function CreatePage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader title="Build your next workflow" />
      <EmptyState
        title="Coming soon"
        description="We're building a powerful creation experience. Check back soon to start crafting workflows here."
      />
    </Container>
  );
}
