---
name: webhookTrigger
description:
  Starts a workflow when an HTTP request hits the workflow's webhook URL and
  exposes the request payload to downstream nodes. Use as the entry point for
  event-driven workflows triggered by an external system or callback.
---
# webhookTrigger

## Parameters

None.

## Output

The incoming JSON request body is available to downstream nodes as `$trigger`.

| key | type | meaning |
|-----|------|---------|
| `$trigger` | object | The parsed JSON payload sent to the webhook URL. |

Reference fields directly, e.g. `$trigger.user_id`, `$trigger.event.type`.

## Notes

- Entry point: every workflow needs exactly one trigger node.
- The webhook URL is assigned on the canvas.
- Reference the payload via `$trigger.<field>`, not by this node's name.
