---
name: scheduledTrigger
description:
  Starts a workflow automatically on a fixed, recurring interval. Use as the
  entry point for automated jobs that must run repeatedly — e.g. every 5 minutes,
  hourly, or once a day.
---
# scheduledTrigger

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `amount` | number | yes | — | How many units between runs (e.g. `5`). |
| `unit` | enum | yes | — | One of `seconds`, `minutes`, `hours`, `days`. |

## Output

None — a scheduled trigger passes no data to downstream nodes.

## Notes

- Entry point: every workflow needs exactly one trigger node.
