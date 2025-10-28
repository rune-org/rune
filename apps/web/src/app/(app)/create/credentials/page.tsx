"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import { CredentialsTable, type Credential } from "@/components/credentials/CredentialsTable";
import { AddCredentialDialog } from "@/components/credentials/AddCredentialDialog";

export default function CreateCredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);

  const handleAddCredential = (newCred: {
    name: string;
    credential_type: Credential["credential_type"];
    credential_data: Record<string, string>;
  }) => {
    // TODO: Replace with actual API call to POST /credentials
    const credential: Credential = {
      id: Date.now(), // Mock ID generation
      name: newCred.name,
      credential_type: newCred.credential_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCredentials((prev) => [...prev, credential]);
  };

  const handleDeleteCredential = (id: number) => {
    // TODO: Replace with actual API call to DELETE /credentials/:id
    if (
      confirm(
        "Are you sure you want to delete this credential? This action cannot be undone.",
      )
    ) {
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    }
  };

  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader
        title="Credentials"
        description="Manage the keys and secrets your workflows need to run."
        actions={<AddCredentialDialog onAdd={handleAddCredential} />}
      />
      <CredentialsTable
        credentials={credentials}
        onDelete={handleDeleteCredential}
      />
    </Container>
  );
}
