---
name: integration.google.gmail.send_email
description:
  Sends an email from a connected Google account through Gmail. Use to send mail
  on the user's behalf from their Gmail, rather than through a generic SMTP
  server.
---
# integration.google.gmail.send_email

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `to` | string | yes | — | Recipient address(es). |
| `subject` | string | yes | — | Email subject. |
| `body` | string | yes | — | Email body. |
| `cc` | string | no | — | CC address(es). |
| `bcc` | string | no | — | BCC address(es). |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Gmail API call. |
| `body` | object | Parsed Gmail API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

The sent message id is in `body.id`. Reference as `$NodeName.body.id`.

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
