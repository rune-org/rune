import type { CredentialType } from "@/client/types.gen";

export interface CredentialRef {
  type: CredentialType;
  id: string;
  name: string;
}

// TODO: extend this set when adding nodes that must ship credentials to the backend.
const NODE_TYPES_REQUIRING_CREDENTIALS = new Set<string>(["smtp"]);

export function isCredentialRef(value: unknown): value is CredentialRef {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.name === "string"
  );
}

export function nodeTypeRequiresCredential(nodeType: string): boolean {
  return NODE_TYPES_REQUIRING_CREDENTIALS.has(nodeType);
}
