import type { CredentialRef } from "@/lib/credentials";

export type IntegrationProvider = "google" | "microsoft" | "slack" | "telegram";

export type IntegrationService = "gmail" | "sheets" | "outlook" | "slack" | "bot";

export type IntegrationNodeKind =
  | "integration.google.gmail.send_email"
  | "integration.google.gmail.read_email"
  | "integration.google.gmail.search_emails"
  | "integration.google.gmail.list_labels"
  | "integration.google.sheets.read_range"
  | "integration.google.sheets.write_range"
  | "integration.google.sheets.append_row"
  | "integration.google.sheets.clear"
  | "integration.google.sheets.create_sheet"
  | "integration.google.sheets.delete_sheet"
  | "integration.google.sheets.delete_rows"
  | "integration.google.sheets.delete_columns"
  | "integration.google.sheets.update_row"
  | "integration.google.sheets.create_spreadsheet"
  | "integration.google.sheets.delete_spreadsheet"
  | "integration.microsoft.outlook.send_email"
  | "integration.microsoft.outlook.read_email"
  | "integration.microsoft.outlook.search_emails"
  | "integration.microsoft.outlook.list_folders"
  | "integration.slack.chat.post_message"
  | "integration.slack.chat.update"
  | "integration.slack.chat.delete"
  | "integration.slack.conversations.history"
  | "integration.slack.conversations.find_message"
  | "integration.slack.users.lookup_by_email"
  | "integration.telegram.bot.send_message"
  | "integration.telegram.bot.send_photo"
  | "integration.telegram.bot.send_document"
  | "integration.telegram.bot.get_updates"
  | "integration.telegram.bot.get_chat_id";

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
