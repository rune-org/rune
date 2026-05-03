import type { CredentialRef } from "@/lib/credentials";

export type IntegrationProvider = "google" | "microsoft";

export type IntegrationService = "gmail" | "sheets" | "outlook";

export type IntegrationNodeKind =
  | "integration.google.gmail.send_email"
  | "integration.google.gmail.read_email"
  | "integration.google.gmail.search_emails"
  | "integration.google.gmail.list_labels"
  | "integration.google.sheets.read_range"
  | "integration.google.sheets.write_range"
  | "integration.google.sheets.append_row"
  | "integration.google.sheets.create_spreadsheet"
  | "integration.microsoft.outlook.send_email"
  | "integration.microsoft.outlook.read_email"
  | "integration.microsoft.outlook.list_inbox";

export type IntegrationNodeData = {
  label?: string;
  credential?: CredentialRef | null;
  pinned?: boolean;
  integrationKind: IntegrationNodeKind;
  arguments?: Record<string, unknown>;
};

export type IntegrationArgumentField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "json";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: readonly { value: string; label: string }[];
};

export type IntegrationToolMetadata = {
  kind: IntegrationNodeKind;
  provider: IntegrationProvider;
  service: IntegrationService;
  tool: string;
  label: string;
  description: string;
  providerLabel: string;
  serviceLabel: string;
  icon: string;
  providerIcon: string;
  colorTheme: {
    base: string;
    bg: string;
    border: string;
  };
  argumentFields: readonly IntegrationArgumentField[];
  defaultArguments: Record<string, unknown>;
};
