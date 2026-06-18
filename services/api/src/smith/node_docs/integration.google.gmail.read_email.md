---
name: integration.google.gmail.read_email
description:
  Reads a single Gmail message by its ID and returns its contents. Use to fetch
  the full details of a specific email — for example one found by a prior search.
---
# integration.google.gmail.read_email

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `id` | string | yes | — | Gmail message ID (e.g. from a search result). |
| `format` | enum | no | `full` | Detail level: `full`, `metadata`, `minimal`, or `raw`. |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Gmail API call. |
| `body` | object | Parsed Gmail message resource. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

The message content is in `body` — e.g. `body.snippet`, `body.payload`.

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
