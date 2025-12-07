"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCredentialsDropdown } from "@/lib/api/credentials";
import type {
  CredentialResponseDropDown,
  CredentialType,
} from "@/client/types.gen";
import type { CredentialRef } from "@/lib/credentials";

interface CredentialSelectorProps {
  credentialType: CredentialType | CredentialType[];
  value: CredentialRef | null | undefined;
  onChange: (credential: CredentialRef | null) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  showHelp?: boolean;
}

export function CredentialSelector({
  credentialType,
  value,
  onChange,
  label = "Credential",
  placeholder = "Select a credential",
  className = "",
  showHelp = false,
}: CredentialSelectorProps) {
  const [credentials, setCredentials] = useState<CredentialResponseDropDown[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredentials = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listCredentialsDropdown();
      if (response.data?.data) {
        // Filter credentials by type
        const types = Array.isArray(credentialType)
          ? credentialType
          : [credentialType];
        const filtered = response.data.data.filter((cred) =>
          types.includes(cred.credential_type)
        );
        setCredentials(filtered);
      }
    } catch (err) {
      setError("Failed to load credentials");
      console.error("Error fetching credentials:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialType]);

  const handleValueChange = (selectedId: string) => {
    if (selectedId === "none") {
      onChange(null);
      return;
    }

    const selected = credentials.find(
      (cred) => cred.id.toString() === selectedId
    );
    if (selected) {
      onChange({
        id: selected.id.toString(),
        type: selected.credential_type,
        name: selected.name,
      });
    }
  };

  const selectedValue = value?.id ?? "none";

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs text-muted-foreground">{label}</label>
        <button
          type="button"
          onClick={fetchCredentials}
          disabled={isLoading}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
          title="Refresh credentials"
          aria-label="Refresh credentials"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <Select
        value={selectedValue}
        onValueChange={handleValueChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No credential</span>
          </SelectItem>
          {credentials.length === 0 && !isLoading && !error && (
            <SelectItem value="empty" disabled>
              <span className="text-muted-foreground">
                No {credentialType} credentials found
              </span>
            </SelectItem>
          )}
          {credentials.map((cred) => (
            <SelectItem key={cred.id} value={cred.id.toString()}>
              {cred.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}

      {showHelp && (
        <div className="text-xs text-muted-foreground/70">
          Select an SMTP credential to use for sending emails
        </div>
      )}
    </div>
  );
}
