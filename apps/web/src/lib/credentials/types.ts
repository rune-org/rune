import type { CredentialType } from "@/client/types.gen";

/**
 * Configuration for credential types with human-friendly labels and descriptions.
 * This ensures type safety and prevents duplication across components.
 */
export const CREDENTIAL_TYPE_CONFIG: Record<
  CredentialType,
  {
    label: string;
    description?: string;
  }
> = {
  api_key: {
    label: "API Key",
    description: "Simple API key authentication",
  },
  oauth2: {
    label: "OAuth2",
    description: "OAuth 2.0 authentication flow",
  },
  basic_auth: {
    label: "Basic Auth",
    description: "Username and password authentication",
  },
  token: {
    label: "Token",
    description: "Bearer token or access token",
  },
  smtp: {
    label: "SMTP",
    description: "Email server credentials",
  },
  header: {
    label: "Header Auth",
    description: "Custom header authentication",
  },
  custom: {
    label: "Custom",
    description: "Custom credential format",
  },
  gemini_api_key: {
    label: "Gemini API Key",
    description: "Google Gemini model API key",
  },
} as const;

/**
 * Get all credential types as an array for dropdowns.
 */
export const getCredentialTypeOptions = () => {
  return (Object.keys(CREDENTIAL_TYPE_CONFIG) as CredentialType[]).map((type) => ({
    value: type,
    label: CREDENTIAL_TYPE_CONFIG[type].label,
    description: CREDENTIAL_TYPE_CONFIG[type].description,
  }));
};

/**
 * Get label for a specific credential type.
 */
export const getCredentialTypeLabel = (type: CredentialType): string => {
  return CREDENTIAL_TYPE_CONFIG[type].label;
};

/**
 * Badge styling configuration for each credential type.
 */
export const CREDENTIAL_TYPE_BADGE_STYLES: Record<CredentialType, { className: string }> = {
  api_key: {
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  },
  oauth2: {
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200",
  },
  basic_auth: {
    className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200",
  },
  token: {
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  },
  smtp: {
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200",
  },
  header: {
    className: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200",
  },
  custom: {
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  gemini_api_key: {
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200",
  },
};
