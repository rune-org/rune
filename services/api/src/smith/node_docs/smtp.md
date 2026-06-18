---
name: smtp
description:
  Sends an email through an SMTP server. Use to send plain notifications or alerts
  when no Google account is connected; prefer
  `integration.google.gmail.send_email` when sending from a connected Google
  account.
---
# smtp

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `to` | array<string> | yes | — | Primary recipient email address(es). |
| `from` | string | yes | — | Sender email address. |
| `subject` | string | yes | — | Email subject line. |
| `body` | string | yes | — | Email body (plain text or HTML). |
| `cc` | array<string> | no | — | CC recipients. |
| `bcc` | array<string> | no | — | BCC recipients. |

All fields support `$Node.field` references.

## Output

| key | type | meaning |
|-----|------|---------|
| `success` | boolean | Whether the email was sent. |
| `message` | string | Status message. |
| `from` | string | Sender used. |
| `to`, `cc`, `bcc` | array | Recipients used. |
| `subject` | string | Subject sent. |
| `recipients` | number | Total recipient count (to + cc + bcc). |
| `duration_ms` | number | Send duration in milliseconds. |

## Notes

- Requires an `smtp` credential selected on the canvas.
