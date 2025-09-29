import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Container } from "@/components/shared/Container";

export default function CreateExecutionsPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Executions"
        description="Track workflow runs and inspect their outputs."
      />
      <EmptyState
        title="No executions to show"
        description="Run a workflow to see recent executions and their status."
      />
    </Container>
  );
}
