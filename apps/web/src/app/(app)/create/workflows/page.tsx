import { PageHeader } from "@/components/layout/PageHeader";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/Container";
import { WorkflowsTable } from "@/components/workflows/WorkflowsTable";

export default function CreateWorkflowsPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Your Workflows"
        actions={
          <Button asChild>
            <Link href="/create/app">Create Workflow</Link>
          </Button>
        }
      />
      <WorkflowsTable />
    </Container>
  );
}
