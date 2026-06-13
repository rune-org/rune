---
name: integration.google.sheets.clear
description:
  Clears the cell values from a Google Sheet or a range within it, leaving
  formatting intact. Use to wipe data before rewriting, or to reset a region.
---
# integration.google.sheets.clear

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `spreadsheet_id` | string | yes | — | The spreadsheet's ID. |
| `sheet_name` | string | yes | — | Worksheet tab name, e.g. `Sheet1`. |
| `range` | string | no | whole sheet | A1-notation range to clear. Omit to clear the entire sheet. |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Sheets API call. |
| `body` | object | Parsed Google Sheets API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

The cleared range is echoed in `body.clearedRange`.

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
