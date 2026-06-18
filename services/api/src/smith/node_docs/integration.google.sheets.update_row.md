---
name: integration.google.sheets.update_row
description:
  Overwrites the values of a specific row in a Google Sheet, starting at a given
  column. Use to edit one existing record by its row number.
---
# integration.google.sheets.update_row

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `spreadsheet_id` | string | yes | — | The spreadsheet's ID. |
| `sheet_name` | string | yes | — | Worksheet tab name, e.g. `Sheet1`. |
| `row_number` | number | yes | — | 1-based row number to update. |
| `start_column` | string | yes | — | Column letter where the values start, e.g. `A`. |
| `values` | 2D array | yes | — | Exactly one row, e.g. `[["Alice","a@example.com"]]`. |
| `value_input_option` | enum | no | — | `USER_ENTERED` or `RAW`. |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Sheets API call. |
| `body` | object | Parsed Google Sheets API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

The number of cells written is in `body.updatedCells`.

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
