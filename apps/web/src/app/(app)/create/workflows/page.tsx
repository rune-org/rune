import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Container } from "@/components/shared/Container";

export default function CreateWorkflowsPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Workflows"
        description="Create and manage your workflows here."
      />
      <EmptyState
        title="No workflows to show"
        description="Create a workflow to see it listed here."
      />
    </Container>
  );
}
