---
name: http
description:
  Makes an HTTP request to an external API or URL and returns the response
  status, body, and headers. Use whenever a workflow needs to call a third-party
  or internal REST/HTTP service that has no dedicated integration node — fetching
  data, posting payloads, calling webhooks, or polling an endpoint.
---
# http

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `url` | string | yes | — | Target URL. Supports `$Node.field` references and `{{...}}` templating. |
| `method` | enum | yes | — | One of `GET`, `POST`, `PUT`, `DELETE`, `PATCH`. |
| `headers` | object | no | — | Request headers as key/value pairs. |
| `query` | object | no | — | URL query parameters as key/value pairs. |
| `body` | any | no | — | Request body — a JSON value or string. |
| `timeout` | string | no | `"30"` | Request timeout in seconds. |
| `retry` | string | no | `"0"` | Number of retry attempts on failure. |
| `retry_delay` | string | no | `"0"` | Delay between retries, in seconds. |
| `raise_on_status` | string | no | — | Comma-separated status patterns to treat as errors, e.g. `4xx,5xx,500`. |
| `ignore_ssl` | boolean | no | `false` | Skip TLS certificate verification. |

## Output

Reference downstream as `$<NodeName>.<key>` (e.g. `$FetchUser.status`,
`$FetchUser.body.email`, `$FetchUser.body.items[0].id`).

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status code (e.g. `200`). |
| `status_text` | string | Status line text (e.g. `200 OK`). |
| `body` | object \| string | Parsed JSON response, or raw text when not JSON. |
| `headers` | object | Response headers as key/value pairs. |
| `duration_ms` | number | Request duration in milliseconds. |

## Notes

- Credential is optional. Public endpoints need none; for an authenticated API,
  select a credential on the canvas.
- `headers`, `query`, and `body` may be written as JSON; they are stored as
  structured objects.
- `timeout`, `retry`, and `retry_delay` are strings — quote numeric values
  (e.g. `"30"`).
- For Gmail or Google Sheets, prefer the dedicated `integration.google.*` nodes.
