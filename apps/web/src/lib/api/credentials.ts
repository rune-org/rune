import {
  createCredentialCredentialsPost,
  deleteCredentialCredentialsCredentialIdDelete,
  listCredentialsCredentialsGet,
  listCredentialsDropdownCredentialsDropdownGet,
  shareCredentialCredentialsCredentialIdSharePost,
  revokeCredentialAccessCredentialsCredentialIdShareUserIdDelete,
  listCredentialSharesCredentialsCredentialIdSharesGet,
  getMyShareInfoCredentialsCredentialIdMyShareGet,
} from "@/client";

import type {
  CredentialCreate,
  CredentialShare,
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

/**
 * Delete a credential
 * @param credentialId - The ID of the credential to delete
 */
export const deleteCredential = (credentialId: number) =>
  deleteCredentialCredentialsCredentialIdDelete({
    path: { credential_id: credentialId },
  });

/**
 * Share a credential with another user
 * @param credentialId - The ID of the credential to share
 * @param payload - The share data containing user_id
 */
export const shareCredential = (credentialId: number, payload: CredentialShare) =>
  shareCredentialCredentialsCredentialIdSharePost({
    path: { credential_id: credentialId },
    body: payload,
  });

/**
 * Revoke a user's access to a credential
 * @param credentialId - The ID of the credential
 * @param userId - The ID of the user to revoke access from
 */
export const revokeCredentialAccess = (credentialId: number, userId: number) =>
  revokeCredentialAccessCredentialsCredentialIdShareUserIdDelete({
    path: { credential_id: credentialId, user_id: userId },
  });

/**
 * List all users who have access to a credential
 * @param credentialId - The ID of the credential
 */
export const listCredentialShares = (credentialId: number) =>
  listCredentialSharesCredentialsCredentialIdSharesGet({
    path: { credential_id: credentialId },
  });

/**
 * Get the current user's share info for a credential
 * This endpoint can be called by shared users to see their own share info
 * @param credentialId - The ID of the credential
 */
export const getMyShareInfo = (credentialId: number) =>
  getMyShareInfoCredentialsCredentialIdMyShareGet({
    path: { credential_id: credentialId },
  });

