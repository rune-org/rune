# Jira OAuth 2.0 (3LO) Full Setup Steps

This guide shows the exact steps to create a Jira OAuth app, find the Client ID and Client Secret, set the callback URL, and connect the credential in Rune.

## A) Create the Jira app

1. Open: https://developer.atlassian.com/console/myapps
2. Click Create app.
3. Choose OAuth 2.0 (3LO).
4. Name the app (example: Rune).
5. Click Create.

## B) Enable OAuth 2.0 (3LO)

1. In the left sidebar, click Authorization.
2. Make sure OAuth 2.0 (3LO) is enabled.

## C) Find Client ID and Client Secret

1. In the left sidebar, click Authorization.
2. Open the OAuth 2.0 (3LO) section.
3. Click Settings (or Configure).
4. You will see:
   - Client ID
   - Client Secret
5. Copy both values.

If you do not see Client ID or Client Secret:

- You are not in the OAuth 2.0 (3LO) settings page. Go back to Authorization and open OAuth 2.0 (3LO) settings.
- If there is a button like Create credentials, click it and the Client ID/Secret will appear.

## D) Add the callback (redirect) URL

Your callback URL is:

- http://127.0.0.1:8000/oauth/callback

Steps:

1. In the OAuth 2.0 (3LO) settings page, find Redirect URLs.
2. Add the callback URL above exactly.
3. Save changes.

## E) Add Jira API scopes

1. In the left sidebar, click Permissions.
2. Under Jira API scopes, add:
   - read:jira-work
   - write:jira-work
   - read:jira-user
   - offline_access (optional but recommended)
3. Save.

## F) Create the OAuth credential in Rune

1. Open Rune -> Credentials -> New Credential -> OAuth2.
2. Fill these values:
   - Authorization URL: https://auth.atlassian.com/authorize
   - Token URL: https://auth.atlassian.com/oauth/token
   - Audience: api.atlassian.com
   - Client ID: (from step C)
   - Client Secret: (from step C)
   - Scopes: same as step E
3. Click Connect and approve access.

## G) Get Cloud ID (no coding)

1. Open this URL in your browser (replace your domain):
   https://your-domain.atlassian.net/_edge/tenant_info
2. Copy the cloudId value.

Example:
https://omarmamon.atlassian.net/_edge/tenant_info

## H) Use Cloud ID in Rune nodes

For Jira nodes in the canvas:

- base_url: leave empty
- cloud_id: paste the cloudId
- api_version: 3

If cloud_id is set, base_url is ignored and requests always use:
https://api.atlassian.com/ex/jira/{cloudId}

This makes the requests go to:
https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...

## I) Common errors

- 401 when using https://your-domain.atlassian.net/rest/api/3/...:
  Use cloud_id instead. OAuth 3LO must use api.atlassian.com/ex/jira/{cloudId}.

- 404 on https://api.atlassian.com/rest/api/3/...:
  You forgot /ex/jira/{cloudId}.

- Missing scopes error:
  Add scopes in Permissions -> Jira API scopes, then reconnect.
