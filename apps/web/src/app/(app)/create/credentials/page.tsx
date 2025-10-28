"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import { CredentialsTable, type Credential } from "@/components/credentials/CredentialsTable";
import { AddCredentialDialog } from "@/components/credentials/AddCredentialDialog";
import { credentials as credentialsAPI } from "@/lib/api";

export default function CreateCredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch credentials on mount
  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await credentialsAPI.listCredentials();
      
      // Extract data from the ApiResponse wrapper
      if (response.data && response.data.data) {
        setCredentials(response.data.data);
      }
    } catch (err) {
      console.error("Failed to load credentials:", err);
      setError("Failed to load credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCredential = async (newCred: {
    name: string;
    credential_type: Credential["credential_type"];
    credential_data: Record<string, string>;
  }) => {
    try {
      const response = await credentialsAPI.createCredential({
        name: newCred.name,
        credential_type: newCred.credential_type,
        credential_data: newCred.credential_data,
      });

      // Extract the created credential from the ApiResponse wrapper
      if (response.data && response.data.data) {
        setCredentials((prev) => [...prev, response.data.data]);
      }
    } catch (err) {
      console.error("Failed to create credential:", err);
      alert("Failed to create credential. Please try again.");
    }
  };

  const handleDeleteCredential = async (id: number) => {
    // TODO: Implement DELETE endpoint in backend and API wrapper
    if (
      confirm(
        "Are you sure you want to delete this credential? This action cannot be undone.",
      )
    ) {
      // Optimistic update - remove from UI immediately
      setCredentials((prev) => prev.filter((c) => c.id !== id));
      
      // TODO: Call API to delete on backend
      // try {
      //   await credentialsAPI.deleteCredential(id);
      // } catch (err) {
      //   console.error("Failed to delete credential:", err);
      //   // Reload credentials to restore UI state on error
      //   loadCredentials();
      //   alert("Failed to delete credential. Please try again.");
      // }
    }
  };

  if (error) {
    return (
      <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
        <div className="text-center text-destructive">
          <p>{error}</p>
          <button
            onClick={loadCredentials}
            className="mt-4 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </Container>
    );
  }

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
        isLoading={isLoading}
      />
    </Container>
  );
}
