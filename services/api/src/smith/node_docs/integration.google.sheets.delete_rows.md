---
name: integration.google.sheets.delete_rows
description:
  Deletes a span of consecutive rows from a Google Sheet. Use to remove records
  by their position in the sheet.
---
# integration.google.sheets.delete_rows

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `spreadsheet_id` | string | yes | — | The spreadsheet's ID. |
| `sheet_name` | string | yes | — | Worksheet tab name, e.g. `Sheet1`. |
| `start_row` | number | yes | — | 1-based first row to delete. |
| `row_count` | number | yes | — | Number of rows to delete. |

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
