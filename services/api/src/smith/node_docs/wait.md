---
name: wait
description:
  Pauses workflow execution for a set duration before continuing. Use to delay a
  step — for example to wait 30 seconds before polling an endpoint again.
---
# wait

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `amount` | number | yes | — | How long to wait. |
| `unit` | enum | yes | — | One of `seconds`, `minutes`, `hours`, `days`. |

## Output

| key | type | meaning |
|-----|------|---------|
| `resume_at` | number | Unix-millisecond time when execution resumes. |
| `timer_id` | string | Identifier of the scheduled timer. |

## Notes

- Execution pauses here and continues automatically when the timer fires.
