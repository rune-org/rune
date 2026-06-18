---
name: integration.google.sheets.create_spreadsheet
description:
  Creates a brand-new, empty Google spreadsheet. Use to start a fresh document
  that the workflow will then populate.
---
# integration.google.sheets.create_spreadsheet

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `title` | string | yes | — | Title of the new spreadsheet. |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Sheets API call. |
| `body` | object | Parsed Google Sheets API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

The new spreadsheet's ID and URL are in `body.spreadsheetId` and
`body.spreadsheetUrl`.

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
