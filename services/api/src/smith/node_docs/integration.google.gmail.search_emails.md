---
name: integration.google.gmail.search_emails
description:
  Searches a connected Gmail account for messages matching a query and returns
  the matches. Use to find emails by sender, subject, label, or read state.
---
# integration.google.gmail.search_emails

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `q` | string | yes | — | Gmail search query, e.g. `is:unread from:boss@example.com`. |
| `maxResults` | number | no | — | Maximum number of results. |
| `labelIds` | string | no | — | Comma-separated label IDs, e.g. `INBOX,UNREAD`. |
| `includeSpamTrash` | boolean | no | — | Include results from spam and trash. |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Gmail API call. |
| `body` | object | Parsed Gmail API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

The matches are in `body.messages` (an array of `{id, threadId}`). Pass an
`id` to `integration.google.gmail.read_email` to fetch a full message.

## Notes

- `maxResults`, `labelIds`, and `includeSpamTrash` use camelCase keys.
- Requires a Google credential selected on the canvas; the node will not run
  without one.
