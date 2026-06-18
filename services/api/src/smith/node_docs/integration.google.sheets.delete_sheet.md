---
name: integration.google.sheets.delete_sheet
description:
  Deletes a sheet (tab) from a Google spreadsheet. Use to remove an entire
  worksheet and all of its data.
---
# integration.google.sheets.delete_sheet

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `spreadsheet_id` | string | yes | — | The spreadsheet's ID. |
| `sheet_name` | string | yes | — | Worksheet tab name to delete. |

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
