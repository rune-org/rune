# OAuth2 credentials (bring your own OAuth client)

Rune uses the **authorization code** grant: your browser visits the provider, you approve access, and the **API** exchanges the one-time `code` for `access_token` / `refresh_token` using your **client secret** (the browser never sees the secret).

## Redirect URI to register

In your provider’s OAuth client settings (for example Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client), set the **authorized redirect URI** to exactly:

`{API_PUBLIC_URL}/oauth/callback`

- `API_PUBLIC_URL` is the public base URL of the Rune API (no trailing slash), as set in the API environment (see `services/api/.env.example`).
- If you use the optional `OAUTH_REDIRECT_URI` override, register **that** full URL instead.

Examples:

- Local API on port 8000: `http://127.0.0.1:8000/oauth/callback`
- API behind nginx at `/api`: `https://your-host.example.com/api/oauth/callback`

A mismatch between this URL and what the provider has on file is the most common cause of `redirect_uri_mismatch` errors.

## Scopes

Enter scopes as a **single space-separated** string on the credential (for example Google Calendar read-only). If you widen scopes later, update the credential and run **Connect** again so the provider can issue tokens for the new scope set.

## After connecting

Set `OAUTH_FRONTEND_SUCCESS_URL` and `OAUTH_FRONTEND_ERROR_URL` to pages on your web app (defaults point at `/create/credentials`). The API redirects there with `?oauth=success` or `?oauth=error&reason=...`.

Workflow runs resolve OAuth2 credentials on the server: tokens are **refreshed when near expiry** (with skew), and only a **safe subset** (`access_token`, `token_type`) is sent to the worker for the HTTP node’s `Authorization` header.
