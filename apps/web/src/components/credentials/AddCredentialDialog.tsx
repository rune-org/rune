"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { CredentialType } from "@/client/types.gen";
import { getCredentialTypeOptions } from "@/lib/credentials/types";

interface AddCredentialDialogProps {
  onAdd: (credential: {
    name: string;
    credential_type: CredentialType;
    credential_data: Record<string, string>;
  }) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CREDENTIAL_TYPES = getCredentialTypeOptions();

// Field configurations for each credential type
const CREDENTIAL_FIELDS: Record<
  CredentialType,
  Array<{
    key: string;
    label: string;
    type: "text" | "password" | "textarea" | "number";
    placeholder?: string;
    required?: boolean;
  }>
> = {
  api_key: [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "sk_live_...",
      required: true,
    },
    {
      key: "base_url",
      label: "Base URL (optional)",
      type: "text",
      placeholder: "https://api.example.com",
    },
  ],
  oauth2: [
    {
      key: "client_id",
      label: "Client ID",
      type: "text",
      required: true,
    },
    {
      key: "client_secret",
      label: "Client Secret",
      type: "password",
      required: true,
    },
    {
      key: "auth_url",
      label: "Authorization URL",
      type: "text",
      placeholder: "https://oauth.example.com/authorize",
    },
    {
      key: "token_url",
      label: "Token URL",
      type: "text",
      placeholder: "https://oauth.example.com/token",
    },
  ],
  basic_auth: [
    {
      key: "username",
      label: "Username",
      type: "text",
      required: true,
    },
    {
      key: "password",
      label: "Password",
      type: "password",
      required: true,
    },
  ],
  token: [
    {
      key: "token",
      label: "Token",
      type: "password",
      placeholder: "Bearer token or access token",
      required: true,
    },
  ],
  smtp: [
    {
      key: "host",
      label: "SMTP Host",
      type: "text",
      placeholder: "smtp.gmail.com",
      required: true,
    },
    {
      key: "port",
      label: "Port",
      type: "number",
      placeholder: "587",
      required: true,
    },
    {
      key: "username",
      label: "Username",
      type: "text",
      required: true,
    },
    {
      key: "password",
      label: "Password",
      type: "password",
      required: true,
    },
  ],
  header: [
    {
      key: "field",
      label: "Header Name",
      type: "text",
      placeholder: "X-API-Key",
      required: true,
    },
    {
      key: "value",
      label: "Header Value",
      type: "password",
      required: true,
    },
  ],
  custom: [
    {
      key: "custom_data",
      label: "Custom Data (JSON)",
      type: "textarea",
      placeholder: '{"key": "value"}',
      required: true,
    },
  ],
};

export function AddCredentialDialog({
  onAdd,
  open: controlledOpen,
  onOpenChange,
}: AddCredentialDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };
  const [name, setName] = useState("");
  const [credentialType, setCredentialType] =
    useState<CredentialType>("api_key");
  const [credentialData, setCredentialData] = useState<Record<string, string>>(
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens in controlled mode
  useEffect(() => {
    if (open && controlledOpen !== undefined) {
      setName("");
      setCredentialType("api_key");
      setCredentialData({});
    }
  }, [open, controlledOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const fields = CREDENTIAL_FIELDS[credentialType];
    const missingFields = fields
      .filter((f) => f.required && !credentialData[f.key]?.trim())
      .map((f) => f.label);

    if (missingFields.length > 0) {
      toast.error(
        `Please fill in required fields: ${missingFields.join(", ")}`
      );
      return;
    }

    // For custom type, try to parse JSON
    if (credentialType === "custom" && credentialData.custom_data) {
      try {
        JSON.parse(credentialData.custom_data);
      } catch {
        toast.error("Invalid JSON in custom data field");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onAdd({
        name: name.trim(),
        credential_type: credentialType,
        credential_data: credentialData,
      });

      // Reset form on success
      setName("");
      setCredentialType("api_key");
      setCredentialData({});
      setOpen(false);
    } catch (error) {
      console.error("Error creating credential:", error);
      // Error handling is done in parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeChange = (value: string) => {
    setCredentialType(value as CredentialType);
    setCredentialData({});
  };

  const updateField = (key: string, value: string) => {
    setCredentialData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button>Add credential</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add credential</DialogTitle>
            <DialogDescription>
              Store a new credential to use in your workflows. All sensitive
              data is encrypted at rest.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My API Credential"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <Select value={credentialType} onValueChange={handleTypeChange}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select credential type" />
                </SelectTrigger>
                <SelectContent>
                  {CREDENTIAL_TYPES.map((type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                      className="pl-8"
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                Credential Details
              </p>
              <div className="flex flex-col gap-3">
                {CREDENTIAL_FIELDS[credentialType].map((field) => (
                  <div key={field.key} className="flex flex-col gap-2">
                    <Label htmlFor={field.key}>
                      {field.label}
                      {field.required && (
                        <span className="text-destructive"> *</span>
                      )}
                    </Label>
                    {field.type === "textarea" ? (
                      <Textarea
                        id={field.key}
                        placeholder={field.placeholder}
                        value={credentialData[field.key] || ""}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        required={field.required}
                        rows={4}
                      />
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={credentialData[field.key] || ""}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add credential"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
