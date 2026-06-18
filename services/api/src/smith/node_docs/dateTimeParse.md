---
name: dateTimeParse
description:
  Parses a date/time string into a normalized timestamp and its calendar parts.
  Use to turn a raw date string into a Unix/ISO value, or into fields like year,
  month, and day for downstream logic.
---
# dateTimeParse

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `date` | string | yes | — | Input date/timestamp to parse. |
| `timezone` | string | no | `UTC` | IANA timezone used to interpret naive inputs. |

## Output

| key | type | meaning |
|-----|------|---------|
| `unix` | number | Unix timestamp in seconds. |
| `iso` | string | ISO-8601 / RFC3339 timestamp. |
| `year`, `month`, `day` | number | Calendar date parts. |
| `hour`, `minute`, `second` | number | Time-of-day parts. |
| `weekday` | string | Day of week, e.g. `Monday`. |
| `timezone` | string | Timezone used. |

Reference downstream as `$NodeName.unix`, `$NodeName.year`, etc.

## Notes

- Unlike the other date nodes, this exposes individual calendar parts and has no
  `format` parameter.
