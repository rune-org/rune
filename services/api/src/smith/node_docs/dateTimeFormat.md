---
name: dateTimeFormat
description:
  Reformats a date/time string into a chosen layout and timezone. Use to normalize
  or present a date in a specific format — for example turning a timestamp into
  "Jan 2, 2006".
---
# dateTimeFormat

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `date` | string | yes | — | Input date/timestamp to reformat. |
| `timezone` | string | no | `UTC` | IANA timezone for parsing and output. |
| `format` | string | no | RFC3339 | Output format as a Go time layout. |

## Output

| key | type | meaning |
|-----|------|---------|
| `result` | string | Date formatted with `format`. |
| `iso` | string | ISO-8601 / RFC3339 timestamp. |
| `unix` | number | Unix timestamp in seconds. |
| `timezone` | string | Timezone used. |

Reference downstream as `$NodeName.result`.

## Notes

- `format` is a Go reference-time layout (e.g. `Jan 2, 2006`), not `YYYY-MM-DD`.
