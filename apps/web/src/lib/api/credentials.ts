import {
  createCredentialCredentialsPost,
  listCredentialsCredentialsGet,
  listCredentialsDropdownCredentialsDropdownGet,
} from "@/client";

import type {
  CredentialCreate,
  CreateCredentialCredentialsPostResponses,
  ListCredentialsCredentialsGetResponses,
  ListCredentialsDropdownCredentialsDropdownGetResponses,
} from "@/client/types.gen";

// Readable wrappers for credentials-related SDK functions

/**
 * Create a new credential
 * @param payload - The credential data to create
 */
export const createCredential = (payload: CredentialCreate) =>
  createCredentialCredentialsPost({ body: payload });

/**
 * List all credentials
 */
export const listCredentials = () => listCredentialsCredentialsGet();

/**
 * List all credentials for dropdown usage
 * Returns minimal credential info (id, name, type)
 */
export const listCredentialsDropdown = () =>
  listCredentialsDropdownCredentialsDropdownGet();

