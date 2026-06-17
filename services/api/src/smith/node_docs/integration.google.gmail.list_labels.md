---
name: integration.google.gmail.list_labels
description:
  Lists every label in a connected Gmail account. Use to discover label names and
  IDs before filtering or searching messages by label.
---
# integration.google.gmail.list_labels

## Parameters

None.

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Gmail API call. |
| `body` | object | Parsed Gmail API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

The labels are in `body.labels` (an array). Reference as `$NodeName.body.labels`.

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
