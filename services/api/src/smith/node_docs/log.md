---
name: log
description:
  Records a message to the execution log at a chosen severity. Use to emit
  debug/info/warn/error output for tracing a run or confirming that a particular
  branch executed.
---
# log

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `message` | string | yes | — | Text to log. Supports `$Node.field` references. |
| `level` | enum | no | `info` | One of `debug`, `info`, `warn`, `error`. |

## Output

| key | type | meaning |
|-----|------|---------|
| `message` | string | The message that was logged. |
| `level` | string | The severity used. |
| `logged_at` | string | ISO-8601 timestamp of when it was written. |

## Notes

- Has no effect on data flow; it only records a message.
