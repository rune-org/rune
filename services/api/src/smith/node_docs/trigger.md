---
name: trigger
description:
  Starts a workflow manually when a user runs it by hand. Use as the entry point
  for any workflow that a person kicks off on demand, rather than on a schedule
  or in response to an incoming request.
---
# trigger

## Parameters

None.

## Output

None — a manual trigger passes no data to downstream nodes.

## Notes

- Entry point: every workflow needs exactly one trigger node.
- Use `scheduledTrigger` for time-based automation, or `webhookTrigger` to start
  from an incoming HTTP request.
