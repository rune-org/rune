---
name: dateTimeSubtract
description:
  Subtracts a duration from a date/time and returns the shifted value. Use to
  compute a past moment — for example "7 days ago" or a cutoff relative to an
  existing date.
---
# dateTimeSubtract

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `amount` | number | yes | — | Number of units to subtract. |
| `date` | string | no | now | Base date/timestamp. Omit to subtract from the current time. |
| `unit` | enum | no | `days` | One of `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`, `years`. |
| `timezone` | string | no | `UTC` | IANA timezone for parsing and output. |
| `format` | string | no | RFC3339 | Output format as a Go time layout. |

## Output

| key | type | meaning |
|-----|------|---------|
| `result` | string | Shifted time formatted with `format`. |
| `iso` | string | ISO-8601 / RFC3339 timestamp. |
| `unix` | number | Unix timestamp in seconds. |
| `timezone` | string | Timezone used. |

Reference downstream as `$NodeName.iso` or `$NodeName.result`.

## Notes

- `format` is a Go reference-time layout (e.g. `2006-01-02`), not `YYYY-MM-DD`.
