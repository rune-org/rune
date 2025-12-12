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
} as const;

/**
 * Get all credential types as an array for dropdowns.
 */
export const getCredentialTypeOptions = () => {
  return (Object.keys(CREDENTIAL_TYPE_CONFIG) as CredentialType[]).map(
    (type) => ({
      value: type,
      label: CREDENTIAL_TYPE_CONFIG[type].label,
      description: CREDENTIAL_TYPE_CONFIG[type].description,
    })
  );
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
export const CREDENTIAL_TYPE_BADGE_STYLES: Record<
  CredentialType,
  { className: string }
> = {
  api_key: {
    className: "bg-blue-900/40 text-blue-200",
  },
  oauth2: {
    className: "bg-purple-900/40 text-purple-200",
  },
  basic_auth: {
    className: "bg-green-900/40 text-green-200",
  },
  token: {
    className: "bg-amber-900/40 text-amber-200",
  },
  smtp: {
    className: "bg-cyan-900/40 text-cyan-200",
  },
  header: {
    className: "bg-pink-900/40 text-pink-200",
  },
  custom: {
    className: "bg-slate-800 text-slate-200",
  },
};
