"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import {
  CredentialsTable,
  type Credential,
} from "@/components/credentials/CredentialsTable";
import { AddCredentialDialog } from "@/components/credentials/AddCredentialDialog";
import { DeleteCredentialDialog } from "@/components/credentials/DeleteCredentialDialog";
import { credentials as credentialsAPI } from "@/lib/api";
import { extractApiErrorMessage } from "@/lib/api/error";
import { toast } from "@/components/ui/toast";

export default function CreateCredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    credentialId: number | null;
    credentialName: string;
  }>({
    open: false,
    credentialId: null,
    credentialName: "",
  });

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

  // TODO(fe): revisit after RBAC

  const handleAddCredential = async (newCred: {
    name: string;
    credential_type: Credential["credential_type"];
    credential_data: Record<string, string>;
  }) => {
    let hasHandledApiError = false;
    try {
      const response = await credentialsAPI.createCredential({
        name: newCred.name,
        credential_type: newCred.credential_type,
        credential_data: newCred.credential_data,
      });

      // Check for errors first
      if (response.error) {
        const errorMessage = extractApiErrorMessage(
          response.error,
          "Failed to create credential. Please try again.",
        );

        hasHandledApiError = true;
        toast.error(errorMessage);
        throw response.error; // Re-throw so the dialog can handle it
      }

      // Extract the created credential from the ApiResponse wrapper
      if (response.data && response.data.data) {
        setCredentials((prev) => [...prev, response.data.data]);
        toast.success("Credential created successfully");
      }
    } catch (err) {
      // Only show generic error if it wasn't already handled above
      // (response.error errors are already shown via toast)
      if (!hasHandledApiError) {
        console.error("Failed to create credential:", err);
        toast.error("Failed to create credential. Please try again.");
      }
      throw err; // Re-throw so the dialog can handle it
    }
  };

  const handleDeleteCredential = (id: number) => {
    const credential = credentials.find((c) => c.id === id);
    if (credential) {
      setDeleteDialog({
        open: true,
        credentialId: id,
        credentialName: credential.name,
      });
    }
  };

  const confirmDelete = async () => {
    if (deleteDialog.credentialId === null) return;

    const id = deleteDialog.credentialId;

    try {
      await credentialsAPI.deleteCredential(id);
      setCredentials((prev) => prev.filter((c) => c.id !== id));
      toast.success("Credential deleted successfully");
    } catch (err) {
      console.error("Failed to delete credential:", err);
      // Reload credentials to restore UI state on error
      loadCredentials();
      toast.error("Failed to delete credential. Please try again.");
    }
  };

  if (error) {
    return (
      <Container
        className="flex flex-col gap-8 py-12"
        widthClassName="max-w-6xl"
      >
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
        onSharesChanged={loadCredentials}
        isLoading={isLoading}
      />
      <DeleteCredentialDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        credentialName={deleteDialog.credentialName}
        onConfirm={confirmDelete}
      />
    </Container>
  );
}
