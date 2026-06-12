"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import {
  CredentialsTable,
  type Credential,
  type CredentialType,
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<Credential["credential_type"] | "all">("all");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    credentialId: number | null;
    credentialName: string;
  }>({
    open: false,
    credentialId: null,
    credentialName: "",
  });

  const loadCredentials = async (
    currentPage = page,
    currentPageSize = pageSize,
    currentQuery = query,
    currentType = typeFilter,
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const params: NonNullable<Parameters<typeof credentialsAPI.listCredentials>[0]> = {
        page: currentPage,
        page_size: currentPageSize,
      };

      const trimmedQuery = currentQuery.trim();
      if (trimmedQuery) {
        params.search = trimmedQuery;
      }

      if (currentType !== "all") {
        params.type = currentType as CredentialType;
      }

      const response = await credentialsAPI.listCredentials(params);

      // Extract data from the ApiResponse wrapper
      if (response.data && response.data.data) {
        const resData = response.data.data;
        if (Array.isArray(resData)) {
          setCredentials(resData);
          setTotal(resData.length);
          setTotalPages(1);
        } else {
          setCredentials(resData.items ?? []);
          setTotal(resData.total ?? 0);
          setTotalPages(resData.total_pages ?? 1);
        }
      }
    } catch (_err) {
      toast.error("Failed to load credentials", {
        action: {
          label: "Retry",
          onClick: () => loadCredentials(currentPage, currentPageSize, currentQuery, currentType),
        },
      });
      setError("Failed to load credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch credentials when pagination or filters change
  useEffect(() => {
    loadCredentials(page, pageSize, query, typeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, query, typeFilter]);

  // OAuth redirect return (API sends browser here with ?oauth=success|error)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (!oauth) return;

    if (oauth === "success") {
      toast.success("OAuth credential connected.");
      void loadCredentials(page, pageSize, query, typeFilter);
    } else if (oauth === "error") {
      const reason = params.get("reason") || "OAuth failed";
      toast.error(decodeURIComponent(reason));
    }

    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        void loadCredentials(page, pageSize, query, typeFilter);
        toast.success("Credential created successfully");
      }
    } catch (err) {
      if (!hasHandledApiError) {
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
      toast.success("Credential deleted successfully");
      void loadCredentials(page, pageSize, query, typeFilter);
    } catch (_err) {
      void loadCredentials(page, pageSize, query, typeFilter);
      toast.error("Failed to delete credential. Please try again.");
    }
  };

  if (error) {
    return (
      <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
        <div className="text-center text-destructive">
          <p>{error}</p>
          <button
            onClick={() => loadCredentials(page, pageSize, query, typeFilter)}
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
        onSharesChanged={() => loadCredentials(page, pageSize, query, typeFilter)}
        isLoading={isLoading}
        page={page}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        query={query}
        setQuery={setQuery}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        total={total}
        totalPages={totalPages}
      />
      <DeleteCredentialDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        credentialId={deleteDialog.credentialId}
        credentialName={deleteDialog.credentialName}
        onConfirm={confirmDelete}
      />
    </Container>
  );
}
