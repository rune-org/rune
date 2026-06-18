---
name: dateTimeNow
description:
  Outputs the current date and time, optionally in a given timezone and format.
  Use when a step needs the present moment — for example a timestamp for a record
  or a filename.
---
# dateTimeNow

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `timezone` | string | no | `UTC` | IANA timezone, e.g. `America/New_York`. |
| `format` | string | no | RFC3339 | Output format as a Go time layout (e.g. `2006-01-02`). |

## Output

| key | type | meaning |
|-----|------|---------|
| `result` | string | Current time formatted with `format`. |
| `iso` | string | ISO-8601 / RFC3339 timestamp. |
| `unix` | number | Unix timestamp in seconds. |
| `timezone` | string | Timezone used. |

Reference downstream as `$NodeName.iso` or `$NodeName.result`.

## Notes

- `format` is a Go reference-time layout (e.g. `2006-01-02 15:04:05`), not
  `YYYY-MM-DD`.
