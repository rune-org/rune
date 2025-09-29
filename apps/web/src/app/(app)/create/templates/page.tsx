import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Container } from "@/components/shared/Container";

export default function CreateTemplatesPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Templates"
        description="Browse reusable templates to jumpstart your next workflow."
      />
      <EmptyState
        title="Templates coming soon"
        description="We'll surface curated templates here to help you move faster."
      />
    </Container>
  );
}
