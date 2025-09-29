import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Container } from "@/components/shared/Container";

export default function ProfilePage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-4xl">
      <PageHeader
        title="Profile"
        description="Manage your profile details and account security."
      />
      <EmptyState
        title="Profile controls coming soon"
        description="Once available, you'll be able to update your personal info here."
      />
    </Container>
  );
}
