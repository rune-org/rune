---
name: integration.google.sheets.create_sheet
description:
  Adds a new sheet (tab) to an existing Google spreadsheet. Use to create a fresh
  worksheet — for example a dated tab — before writing data to it.
---
# integration.google.sheets.create_sheet

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `spreadsheet_id` | string | yes | — | The spreadsheet's ID. |
| `title` | string | yes | — | Title of the new tab. |
| `rows` | number | no | — | Number of rows (e.g. 100). |
| `columns` | number | no | — | Number of columns (e.g. 26). |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Sheets API call. |
| `body` | object | Parsed Google Sheets `batchUpdate` reply. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
